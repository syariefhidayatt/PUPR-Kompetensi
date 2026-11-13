import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import { RUMPUN_LABEL, type JenjangInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

export async function listJenjang(q: string | undefined, page: number, f: Filters = {}) {
  const rumpun = fEnum(f.rumpun, ["KEAHLIAN", "KETERAMPILAN"] as const);
  const where: Prisma.JenjangJabatanWhereInput = {
    ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
    AND: andOf<Prisma.JenjangJabatanWhereInput>([f.nama && { nama: ci(f.nama) }, rumpun && { rumpun }, fInt(f.urutan) !== undefined && { urutan: fInt(f.urutan) as number }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
  };
  const [rows, total] = await Promise.all([
    db.jenjangJabatan.findMany({ where, orderBy: [{ rumpun: "asc" }, { urutan: "asc" }, { nama: "asc" }], skip: skip(page), take: PAGE_SIZE }),
    db.jenjangJabatan.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("jenjang", r.id),
    nama: r.nama,
    rumpun: r.rumpun,
    rumpunLabel: RUMPUN_LABEL[r.rumpun],
    urutan: r.urutan,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function assertFree(input: JenjangInput, exceptId?: bigint) {
  // Hanya nama yang unik. Urutan sengaja boleh kembar: rumpun Keahlian (Pertama..Utama) dan
  // Keterampilan (Pemula..Penyelia) sama-sama berurutan 1..4 di DB CI4.
  const notSelf = exceptId ? { NOT: { id: exceptId } } : {};
  const byNama = await db.jenjangJabatan.findFirst({
    where: { nama: { equals: input.nama, mode: "insensitive" }, ...notSelf },
    select: { id: true },
  });
  if (byNama) throw new AppError("CONFLICT", 409, "Nama jenjang sudah terdaftar.", { nama: ["Nama sudah dipakai"] });
}

export async function createJenjang(input: JenjangInput, actor: string) {
  await assertFree(input);
  const row = await db.jenjangJabatan.create({
    data: { nama: input.nama, rumpun: input.rumpun, urutan: input.urutan, statusAktif: input.statusAktif },
  });
  await audit("create", { entitas: "JenjangJabatan", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("jenjang", row.id) };
}

export async function updateJenjang(token: string, input: JenjangInput, actor: string) {
  const id = decodeOr404("jenjang", token);
  const current = await db.jenjangJabatan.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  await assertFree(input, id);
  await db.jenjangJabatan.update({
    where: { id },
    data: { nama: input.nama, rumpun: input.rumpun, urutan: input.urutan, statusAktif: input.statusAktif },
  });
  await audit("update", { entitas: "JenjangJabatan", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeJenjang(token: string, actor: string) {
  const id = decodeOr404("jenjang", token);
  const current = await db.jenjangJabatan.findUnique({ where: { id }, select: { nama: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

  const [pelatihan, penempatan] = await Promise.all([
    db.pelatihanJenjang.count({ where: { idJenjang: id } }),
    db.pegawaiPenempatan.count({ where: { idJenjang: id } }),
  ]);
  conflictIfUsed("Jenjang", [
    ["pelatihan", pelatihan],
    ["penempatan pegawai", penempatan],
  ]);

  await db.jenjangJabatan.delete({ where: { id } });
  await audit("delete", { entitas: "JenjangJabatan", entitasId: String(id), actor, meta: { nama: current.nama } });
}
