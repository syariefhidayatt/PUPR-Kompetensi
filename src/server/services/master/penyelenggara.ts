import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { PenyelenggaraInput } from "@/lib/schemas/batch";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

export async function listPenyelenggara(q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.PenyelenggaraWhereInput = {
    deletedAt: null,
    ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
    AND: andOf<Prisma.PenyelenggaraWhereInput>([f.nama && { nama: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
  };
  const [rows, total] = await Promise.all([
    db.penyelenggara.findMany({ where, orderBy: { nama: "asc" }, skip: skip(page), take: PAGE_SIZE }),
    db.penyelenggara.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({ id: ids().encode("penyelenggara", r.id), nama: r.nama, statusAktif: r.statusAktif }));
  return { rows: data, total };
}

async function assertNamaFree(nama: string, exceptId?: bigint) {
  const dup = await db.penyelenggara.findFirst({
    where: { nama: { equals: nama, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new AppError("CONFLICT", 409, "Nama penyelenggara sudah terdaftar.", { nama: ["Nama sudah dipakai"] });
}

export async function createPenyelenggara(input: PenyelenggaraInput, actor: string) {
  await assertNamaFree(input.nama);
  const row = await db.penyelenggara.create({ data: { nama: input.nama, statusAktif: input.statusAktif, createdBy: actor } });
  await audit("create", { entitas: "Penyelenggara", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("penyelenggara", row.id) };
}

export async function updatePenyelenggara(token: string, input: PenyelenggaraInput, actor: string) {
  const id = decodeOr404("penyelenggara", token);
  const cur = await db.penyelenggara.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!cur) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  await assertNamaFree(input.nama, id);
  await db.penyelenggara.update({ where: { id }, data: { nama: input.nama, statusAktif: input.statusAktif, updatedBy: actor } });
  await audit("update", { entitas: "Penyelenggara", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removePenyelenggara(token: string, actor: string) {
  const id = decodeOr404("penyelenggara", token);
  const cur = await db.penyelenggara.findFirst({ where: { id, deletedAt: null }, select: { nama: true } });
  if (!cur) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  conflictIfUsed("Penyelenggara", [["batch", await db.pelatihanBatch.count({ where: { idPenyelenggara: id } })]]);
  await db.penyelenggara.delete({ where: { id } });
  await audit("delete", { entitas: "Penyelenggara", entitasId: String(id), actor, meta: { nama: cur.nama } });
}
