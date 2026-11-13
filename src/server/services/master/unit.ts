import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { UnitKerjaInput, UnitOrganisasiInput } from "@/lib/schemas/unit";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

// Unit dimiliki instansi: admin instansi hanya melihat/mengubah unit instansinya; admin pusat semuanya.
const own = (scope: Scope): { idInstansi?: bigint; id?: bigint } =>
  scope.kind === "all" ? {} : scope.kind === "instansi" ? { idInstansi: scope.idInstansi } : { id: -1n };

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const invalid = (field: string, msg: string) => new AppError("INVALID", 422, msg, { [field]: [msg] });

/** Instansi harus ada dan (untuk admin instansi) sama dengan instansinya sendiri. */
async function resolveInstansi(token: string, scope: Scope) {
  const id = ids().decode("instansi", token);
  const ok = id !== null && (scope.kind === "all" || (scope.kind === "instansi" && scope.idInstansi === id));
  const row = ok ? await db.instansi.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!row) throw invalid("instansi", "Instansi tidak valid.");
  return row.id;
}

// ---------- Unit organisasi ----------
export async function listUnitOrganisasi(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.UnitOrganisasiWhereInput = {
    ...own(scope),
    AND: andOf<Prisma.UnitOrganisasiWhereInput>([f.instansi && { instansi: { nama: ci(f.instansi) } }, f.kode && { kode: ci(f.kode) }, f.nama && { nama: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
    ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" } }, { kode: { contains: q, mode: "insensitive" } }, { instansi: { nama: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.unitOrganisasi.findMany({ where, orderBy: [{ instansi: { nama: "asc" } }, { nama: "asc" }], skip: skip(page), take: PAGE_SIZE, include: { instansi: { select: { id: true, nama: true } } } }),
    db.unitOrganisasi.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("unitOrganisasi", r.id),
    instansi: ids().encode("instansi", r.instansi.id),
    instansiNama: r.instansi.nama,
    kode: r.kode,
    nama: r.nama,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function assertKodeFreeUO(idInstansi: bigint, kode: string, exceptId?: bigint) {
  const dup = await db.unitOrganisasi.findFirst({ where: { idInstansi, kode: { equals: kode, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new AppError("CONFLICT", 409, "Kode unit sudah dipakai di instansi ini.", { kode: ["Kode sudah dipakai"] });
}

export async function createUnitOrganisasi(input: UnitOrganisasiInput, actor: string, scope: Scope) {
  const idInstansi = await resolveInstansi(input.instansi, scope);
  await assertKodeFreeUO(idInstansi, input.kode);
  const row = await db.unitOrganisasi.create({ data: { idInstansi, kode: input.kode, nama: input.nama, statusAktif: input.statusAktif } });
  await audit("create", { entitas: "UnitOrganisasi", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("unitOrganisasi", row.id) };
}

export async function updateUnitOrganisasi(token: string, input: UnitOrganisasiInput, actor: string, scope: Scope) {
  const id = decodeOr404("unitOrganisasi", token);
  const cur = await db.unitOrganisasi.findFirst({ where: { id, ...own(scope) }, select: { id: true, idInstansi: true } });
  if (!cur) throw NOT_FOUND();
  const idInstansi = await resolveInstansi(input.instansi, scope);
  if (idInstansi !== cur.idInstansi) {
    const dipakai = await Promise.all([db.unitKerja.count({ where: { idUnitOrganisasi: id } }), db.pegawaiPenempatan.count({ where: { idUnitOrganisasi: id } })]);
    if (dipakai.some((n) => n > 0)) throw invalid("instansi", "Instansi tidak dapat diubah karena unit ini sudah dipakai (unit kerja/penempatan).");
  }
  await assertKodeFreeUO(idInstansi, input.kode, id);
  await db.unitOrganisasi.update({ where: { id }, data: { idInstansi, kode: input.kode, nama: input.nama, statusAktif: input.statusAktif } });
  await audit("update", { entitas: "UnitOrganisasi", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeUnitOrganisasi(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("unitOrganisasi", token);
  const cur = await db.unitOrganisasi.findFirst({ where: { id, ...own(scope) }, select: { nama: true } });
  if (!cur) throw NOT_FOUND();
  conflictIfUsed("Unit organisasi", [
    ["unit kerja", await db.unitKerja.count({ where: { idUnitOrganisasi: id } })],
    ["penempatan pegawai", await db.pegawaiPenempatan.count({ where: { idUnitOrganisasi: id } })],
  ]);
  await db.unitOrganisasi.delete({ where: { id } });
  await audit("delete", { entitas: "UnitOrganisasi", entitasId: String(id), actor, meta: { nama: cur.nama } });
}

export async function unitOrganisasiOptions(scope: Scope) {
  const rows = await db.unitOrganisasi.findMany({ where: own(scope), orderBy: [{ instansi: { nama: "asc" } }, { nama: "asc" }], select: { id: true, nama: true, instansi: { select: { nama: true } } } });
  return rows.map((r) => ({ value: ids().encode("unitOrganisasi", r.id), label: `${r.nama} — ${r.instansi.nama}` }));
}

// ---------- Unit kerja ----------
export async function listUnitKerja(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.UnitKerjaWhereInput = {
    ...own(scope),
    AND: andOf<Prisma.UnitKerjaWhereInput>([f.instansi && { instansi: { nama: ci(f.instansi) } }, f.uo && { unitOrganisasi: { nama: ci(f.uo) } }, f.kode && { kode: ci(f.kode) }, f.nama && { nama: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
    ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" } }, { kode: { contains: q, mode: "insensitive" } }, { instansi: { nama: { contains: q, mode: "insensitive" } } }, { unitOrganisasi: { nama: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.unitKerja.findMany({
      where,
      orderBy: [{ instansi: { nama: "asc" } }, { nama: "asc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: { instansi: { select: { id: true, nama: true } }, unitOrganisasi: { select: { id: true, nama: true } } },
    }),
    db.unitKerja.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("unitKerja", r.id),
    instansi: ids().encode("instansi", r.instansi.id),
    instansiNama: r.instansi.nama,
    unitOrganisasi: r.unitOrganisasi ? ids().encode("unitOrganisasi", r.unitOrganisasi.id) : "",
    unitOrganisasiNama: r.unitOrganisasi?.nama ?? "—",
    kode: r.kode,
    nama: r.nama,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

/** Unit organisasi (opsional) harus ada, dalam scope, dan satu instansi dengan unit kerja. */
async function resolveUO(token: string | undefined, idInstansi: bigint, scope: Scope): Promise<bigint | null> {
  if (!token) return null;
  const id = ids().decode("unitOrganisasi", token);
  const uo = id === null ? null : await db.unitOrganisasi.findFirst({ where: { id, ...own(scope) }, select: { id: true, idInstansi: true } });
  if (!uo || uo.idInstansi !== idInstansi) throw invalid("unitOrganisasi", "Unit organisasi tidak valid untuk instansi ini.");
  return uo.id;
}

async function assertKodeFreeUK(idInstansi: bigint, kode: string, exceptId?: bigint) {
  const dup = await db.unitKerja.findFirst({ where: { idInstansi, kode: { equals: kode, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new AppError("CONFLICT", 409, "Kode unit kerja sudah dipakai di instansi ini.", { kode: ["Kode sudah dipakai"] });
}

export async function createUnitKerja(input: UnitKerjaInput, actor: string, scope: Scope) {
  const idInstansi = await resolveInstansi(input.instansi, scope);
  const idUnitOrganisasi = await resolveUO(input.unitOrganisasi, idInstansi, scope);
  await assertKodeFreeUK(idInstansi, input.kode);
  const row = await db.unitKerja.create({ data: { idInstansi, idUnitOrganisasi, kode: input.kode, nama: input.nama, statusAktif: input.statusAktif } });
  await audit("create", { entitas: "UnitKerja", entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode("unitKerja", row.id) };
}

export async function updateUnitKerja(token: string, input: UnitKerjaInput, actor: string, scope: Scope) {
  const id = decodeOr404("unitKerja", token);
  const cur = await db.unitKerja.findFirst({ where: { id, ...own(scope) }, select: { id: true, idInstansi: true } });
  if (!cur) throw NOT_FOUND();
  const idInstansi = await resolveInstansi(input.instansi, scope);
  if (idInstansi !== cur.idInstansi && (await db.pegawaiPenempatan.count({ where: { idUnitKerja: id } })) > 0) {
    throw invalid("instansi", "Instansi tidak dapat diubah karena unit kerja ini sudah dipakai penempatan pegawai.");
  }
  const idUnitOrganisasi = await resolveUO(input.unitOrganisasi, idInstansi, scope);
  await assertKodeFreeUK(idInstansi, input.kode, id);
  await db.unitKerja.update({ where: { id }, data: { idInstansi, idUnitOrganisasi, kode: input.kode, nama: input.nama, statusAktif: input.statusAktif } });
  await audit("update", { entitas: "UnitKerja", entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeUnitKerja(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("unitKerja", token);
  const cur = await db.unitKerja.findFirst({ where: { id, ...own(scope) }, select: { nama: true } });
  if (!cur) throw NOT_FOUND();
  conflictIfUsed("Unit kerja", [["penempatan pegawai", await db.pegawaiPenempatan.count({ where: { idUnitKerja: id } })]]);
  await db.unitKerja.delete({ where: { id } });
  await audit("delete", { entitas: "UnitKerja", entitasId: String(id), actor, meta: { nama: cur.nama } });
}
