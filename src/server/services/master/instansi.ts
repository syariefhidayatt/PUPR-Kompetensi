import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { InstansiInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

export const JENIS_LABEL: Record<number, string> = {
  1: "Pusat / Pembina",
  2: "Daerah",
  3: "Pembina lain",
  4: "Lainnya",
};

function scopeWhere(scope: Scope): Prisma.InstansiWhereInput {
  if (scope.kind === "all") return {};
  if (scope.kind === "instansi") return { id: scope.idInstansi };
  return { id: -1n }; // "self" tidak berhak melihat master instansi
}

export async function listInstansi(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.InstansiWhereInput = {
    ...scopeWhere(scope),
    ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
    AND: andOf<Prisma.InstansiWhereInput>([f.nama && { nama: ci(f.nama) }, fInt(f.jenis) !== undefined && { jenis: fInt(f.jenis) as number }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
  };
  const [rows, total] = await Promise.all([
    db.instansi.findMany({ where, orderBy: { nama: "asc" }, skip: skip(page), take: PAGE_SIZE }),
    db.instansi.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("instansi", r.id),
    nama: r.nama,
    jenis: String(r.jenis),
    jenisLabel: JENIS_LABEL[r.jenis] ?? "-",
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

/** Opsi dropdown (dipakai form JF). Ikut dibatasi scope. */
export async function instansiOptions(scope: Scope) {
  const rows = await db.instansi.findMany({
    where: scopeWhere(scope),
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, statusAktif: true },
  });
  return rows.map((r) => ({
    value: ids().encode("instansi", r.id),
    label: r.statusAktif ? r.nama : `${r.nama} (nonaktif)`,
  }));
}

async function assertNamaFree(nama: string, exceptId?: bigint) {
  const dup = await db.instansi.findFirst({
    where: { nama: { equals: nama, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new AppError("CONFLICT", 409, "Nama instansi sudah terdaftar.", { nama: ["Nama sudah dipakai"] });
}

export async function createInstansi(input: InstansiInput, actor: string) {
  await assertNamaFree(input.nama);
  const row = await db.instansi.create({
    data: { nama: input.nama, jenis: input.jenis, statusAktif: input.statusAktif },
  });
  await audit("create", { entitas: "Instansi", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("instansi", row.id) };
}

export async function updateInstansi(token: string, input: InstansiInput, actor: string) {
  const id = decodeOr404("instansi", token);
  const current = await db.instansi.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  await assertNamaFree(input.nama, id);
  await db.instansi.update({
    where: { id },
    data: { nama: input.nama, jenis: input.jenis, statusAktif: input.statusAktif },
  });
  await audit("update", { entitas: "Instansi", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeInstansi(token: string, actor: string) {
  const id = decodeOr404("instansi", token);
  const current = await db.instansi.findUnique({ where: { id }, select: { nama: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

  const [jf, penempatan, users] = await Promise.all([
    db.jf.count({ where: { idInstansi: id } }),
    db.pegawaiPenempatan.count({ where: { idInstansi: id } }),
    db.user.count({ where: { idInstansi: id } }),
  ]);
  conflictIfUsed("Instansi", [
    ["JF", jf],
    ["penempatan pegawai", penempatan],
    ["akun pengguna", users],
  ]);

  await db.instansi.delete({ where: { id } });
  await audit("delete", { entitas: "Instansi", entitasId: String(id), actor, meta: { nama: current.nama } });
}
