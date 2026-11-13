import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { JfInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

function scopeWhere(scope: Scope): Prisma.JfWhereInput {
  if (scope.kind === "all") return {};
  if (scope.kind === "instansi") return { idInstansi: scope.idInstansi };
  return { id: -1n };
}

export async function listJf(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.JfWhereInput = {
    ...scopeWhere(scope),
    AND: andOf<Prisma.JfWhereInput>([f.instansi && { instansi: { nama: ci(f.instansi) } }, f.kode && { kodeJf: ci(f.kode) }, f.nama && { namaJf: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
    ...(q
      ? {
          OR: [
            { namaJf: { contains: q, mode: "insensitive" } },
            { kodeJf: { contains: q, mode: "insensitive" } },
            { instansi: { nama: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.jf.findMany({
      where,
      orderBy: [{ instansi: { nama: "asc" } }, { namaJf: "asc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: { instansi: { select: { id: true, nama: true } } },
    }),
    db.jf.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("jf", r.id),
    instansi: ids().encode("instansi", r.instansi.id), // token, cocok dengan field select
    instansiNama: r.instansi.nama,
    kodeJf: r.kodeJf ?? "",
    namaJf: r.namaJf,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function resolveInstansi(token: string) {
  const idInstansi = decodeOr404("instansi", token);
  const instansi = await db.instansi.findUnique({ where: { id: idInstansi }, select: { id: true } });
  if (!instansi) throw new AppError("INVALID", 422, "Instansi tidak ditemukan.", { instansi: ["Instansi tidak valid"] });
  return idInstansi;
}

async function assertNamaFree(idInstansi: bigint, namaJf: string, exceptId?: bigint) {
  const dup = await db.jf.findFirst({
    where: { idInstansi, namaJf: { equals: namaJf, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new AppError("CONFLICT", 409, "JF dengan nama ini sudah ada di instansi tersebut.", { namaJf: ["Nama sudah dipakai"] });
}

// Catatan otorisasi: hanya role dengan permission jf.create/update/delete (admin_pusat) yang bisa sampai ke sini.
export async function createJf(input: JfInput, actor: string) {
  const idInstansi = await resolveInstansi(input.instansi);
  await assertNamaFree(idInstansi, input.namaJf);
  const row = await db.jf.create({
    data: { idInstansi, kodeJf: input.kodeJf ?? null, namaJf: input.namaJf, statusAktif: input.statusAktif },
  });
  await audit("create", { entitas: "Jf", entitasId: String(row.id), actor, meta: { namaJf: input.namaJf } });
  return { id: ids().encode("jf", row.id) };
}

export async function updateJf(token: string, input: JfInput, actor: string) {
  const id = decodeOr404("jf", token);
  const current = await db.jf.findUnique({ where: { id }, select: { id: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  const idInstansi = await resolveInstansi(input.instansi);
  await assertNamaFree(idInstansi, input.namaJf, id);
  await db.jf.update({
    where: { id },
    data: { idInstansi, kodeJf: input.kodeJf ?? null, namaJf: input.namaJf, statusAktif: input.statusAktif },
  });
  await audit("update", { entitas: "Jf", entitasId: String(id), actor, meta: { namaJf: input.namaJf } });
}

export async function removeJf(token: string, actor: string) {
  const id = decodeOr404("jf", token);
  const current = await db.jf.findUnique({ where: { id }, select: { namaJf: true } });
  if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

  const [kompetensi, program, penempatan] = await Promise.all([
    db.kompetensi.count({ where: { idJf: id } }),
    db.programBangkom.count({ where: { idJf: id } }),
    db.pegawaiPenempatan.count({ where: { idJf: id } }),
  ]);
  conflictIfUsed("JF", [
    ["kompetensi", kompetensi],
    ["program bangkom", program],
    ["penempatan pegawai", penempatan],
  ]);

  await db.jf.delete({ where: { id } });
  await audit("delete", { entitas: "Jf", entitasId: String(id), actor, meta: { namaJf: current.namaJf } });
}

/** Opsi dropdown JF (form Kompetensi/Program). Dibatasi scope; label memuat instansi agar nama JF kembar terbedakan. */
export async function jfOptions(scope: Scope) {
  const rows = await db.jf.findMany({
    where: scopeWhere(scope),
    orderBy: [{ instansi: { nama: "asc" } }, { namaJf: "asc" }],
    select: { id: true, namaJf: true, statusAktif: true, instansi: { select: { nama: true } } },
  });
  return rows.map((r) => ({
    value: ids().encode("jf", r.id),
    label: `${r.namaJf} — ${r.instansi.nama}${r.statusAktif ? "" : " (nonaktif)"}`,
  }));
}
