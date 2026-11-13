import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { SertifikasiInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

export async function listSertifikasi(q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.SertifikasiWhereInput = {
    ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
    AND: andOf<Prisma.SertifikasiWhereInput>([f.nama && { nama: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
  };
  const [rows, total] = await Promise.all([
    db.sertifikasi.findMany({ where, orderBy: { nama: "asc" }, skip: skip(page), take: PAGE_SIZE }),
    db.sertifikasi.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("sertifikasi", r.id),
    nama: r.nama,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function assertNamaFree(nama: string, exceptId?: bigint) {
  const dup = await db.sertifikasi.findFirst({
    where: { nama: { equals: nama, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new AppError("CONFLICT", 409, "Nama sertifikasi sudah terdaftar.", { nama: ["Nama sudah dipakai"] });
}

export async function createSertifikasi(input: SertifikasiInput, actor: string) {
  await assertNamaFree(input.nama);
  const row = await db.sertifikasi.create({ data: { nama: input.nama, statusAktif: input.statusAktif } });
  await audit("create", { entitas: "Sertifikasi", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("sertifikasi", row.id) };
}

export async function updateSertifikasi(token: string, input: SertifikasiInput, actor: string) {
  const id = decodeOr404("sertifikasi", token);
  const current = await db.sertifikasi.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  await assertNamaFree(input.nama, id);
  await db.sertifikasi.update({ where: { id }, data: { nama: input.nama, statusAktif: input.statusAktif } });
  await audit("update", { entitas: "Sertifikasi", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeSertifikasi(token: string, actor: string) {
  const id = decodeOr404("sertifikasi", token);
  const current = await db.sertifikasi.findUnique({ where: { id }, select: { nama: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

  conflictIfUsed("Sertifikasi", [["pelatihan", await db.pelatihanSertifikasi.count({ where: { idSertifikasi: id } })]]);

  await db.sertifikasi.delete({ where: { id } });
  await audit("delete", { entitas: "Sertifikasi", entitasId: String(id), actor, meta: { nama: current.nama } });
}
