import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { KompetensiInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { resolveDetail, resolveJf } from "./refs";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

/** Lingkup baris Kompetensi mengikuti instansi pemilik JF-nya. Selain admin_pusat: hanya instansi sendiri. */
function scopeWhere(scope: Scope): Prisma.KompetensiWhereInput {
  if (scope.kind === "all") return {};
  if (scope.kind === "instansi") return { jf: { idInstansi: scope.idInstansi } };
  return { id: -1n };
}

export async function listKompetensi(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.KompetensiWhereInput = {
    ...scopeWhere(scope),
    AND: andOf<Prisma.KompetensiWhereInput>([
      f.instansi && { jf: { instansi: { nama: ci(f.instansi) } } },
      f.jf && { jf: { namaJf: ci(f.jf) } },
      f.jenis && { detail: { jenis: { namaJenis: ci(f.jenis) } } },
      f.sub && { detail: { namaDetail: ci(f.sub) } },
      f.nama && { namaKompetensi: ci(f.nama) },
      fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean },
    ]),
    ...(q
      ? {
          OR: [
            { namaKompetensi: { contains: q, mode: "insensitive" } },
            { jf: { namaJf: { contains: q, mode: "insensitive" } } },
            { jf: { instansi: { nama: { contains: q, mode: "insensitive" } } } },
            { detail: { namaDetail: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.kompetensi.findMany({
      where,
      orderBy: [{ jf: { instansi: { nama: "asc" } } }, { jf: { namaJf: "asc" } }, { namaKompetensi: "asc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: { jf: { include: { instansi: { select: { nama: true } } } }, detail: { include: { jenis: true } } },
    }),
    db.kompetensi.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("kompetensi", r.id),
    jf: ids().encode("jf", r.idJf), // token, cocok dengan field select
    jenisDetail: ids().encode("jenisDetail", r.idJenisDetail),
    jfNama: `${r.jf.namaJf} — ${r.jf.instansi.nama}`,
    instansiNama: r.jf.instansi.nama,
    jfSaja: r.jf.namaJf,
    jenisLabel: `${r.detail.jenis.namaJenis} › ${r.detail.namaDetail}`,
    namaKompetensi: r.namaKompetensi,
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function assertNamaFree(idJf: bigint, idJenisDetail: bigint, nama: string, exceptId?: bigint) {
  const dup = await db.kompetensi.findFirst({
    where: {
      idJf,
      idJenisDetail,
      namaKompetensi: { equals: nama, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) {
    throw new AppError("CONFLICT", 409, "Kompetensi dengan nama ini sudah ada pada JF dan sub jenis tersebut.", {
      namaKompetensi: ["Nama sudah dipakai"],
    });
  }
}

/** Baris yang boleh disentuh aktor, atau 404 (anti-IDOR: token milik instansi lain = tidak ditemukan). */
async function findInScope(id: bigint, scope: Scope) {
  const row = await db.kompetensi.findFirst({ where: { id, ...scopeWhere(scope) }, select: { id: true, namaKompetensi: true } });
  if (!row) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  return row;
}

export async function createKompetensi(input: KompetensiInput, actor: string, scope: Scope) {
  const idJf = await resolveJf(input.jf, scope);
  const idJenisDetail = await resolveDetail(input.jenisDetail);
  await assertNamaFree(idJf, idJenisDetail, input.namaKompetensi);
  const row = await db.kompetensi.create({
    data: { idJf, idJenisDetail, namaKompetensi: input.namaKompetensi, statusAktif: input.statusAktif, createdBy: actor },
  });
  await audit("create", { entitas: "Kompetensi", entitasId: String(row.id), actor, meta: { nama: input.namaKompetensi } });
  return { id: ids().encode("kompetensi", row.id) };
}

export async function updateKompetensi(token: string, input: KompetensiInput, actor: string, scope: Scope) {
  const id = decodeOr404("kompetensi", token);
  await findInScope(id, scope);
  const idJf = await resolveJf(input.jf, scope); // JF tujuan juga harus dalam scope
  const idJenisDetail = await resolveDetail(input.jenisDetail);
  await assertNamaFree(idJf, idJenisDetail, input.namaKompetensi, id);
  await db.kompetensi.update({
    where: { id },
    data: { idJf, idJenisDetail, namaKompetensi: input.namaKompetensi, statusAktif: input.statusAktif, updatedBy: actor },
  });
  await audit("update", { entitas: "Kompetensi", entitasId: String(id), actor, meta: { nama: input.namaKompetensi } });
}

export async function removeKompetensi(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("kompetensi", token);
  const current = await findInScope(id, scope);
  conflictIfUsed("Kompetensi", [["pelatihan", await db.pelatihanKompetensi.count({ where: { idKompetensi: id } })]]);
  await db.kompetensi.delete({ where: { id } });
  await audit("delete", { entitas: "Kompetensi", entitasId: String(id), actor, meta: { nama: current.namaKompetensi } });
}
