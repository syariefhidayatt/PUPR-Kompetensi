import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import type { ProgramInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { resolveDetail, resolveJf, viaJfScope } from "./refs";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

const scopeWhere = (scope: Scope) => viaJfScope(scope) as Prisma.ProgramBangkomWhereInput;

export async function listProgram(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const where: Prisma.ProgramBangkomWhereInput = {
    ...scopeWhere(scope),
    AND: andOf<Prisma.ProgramBangkomWhereInput>([
      f.instansi && { jf: { instansi: { nama: ci(f.instansi) } } },
      f.jf && { jf: { namaJf: ci(f.jf) } },
      f.jenis && { detail: { jenis: { namaJenis: ci(f.jenis) } } },
      f.sub && { detail: { namaDetail: ci(f.sub) } },
      f.nama && { namaProgram: ci(f.nama) },
      f.kategori && { kategori: f.kategori },
      fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean },
    ]),
    ...(q
      ? {
          OR: [
            { namaProgram: { contains: q, mode: "insensitive" } },
            { jf: { namaJf: { contains: q, mode: "insensitive" } } },
            { jf: { instansi: { nama: { contains: q, mode: "insensitive" } } } },
            { detail: { namaDetail: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.programBangkom.findMany({
      where,
      orderBy: [{ jf: { instansi: { nama: "asc" } } }, { jf: { namaJf: "asc" } }, { namaProgram: "asc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: { jf: { include: { instansi: { select: { nama: true } } } }, detail: { include: { jenis: true } } },
    }),
    db.programBangkom.count({ where }),
  ]);
  const data: MasterRow[] = rows.map((r) => ({
    id: ids().encode("program", r.id),
    jf: ids().encode("jf", r.idJf),
    jenisDetail: ids().encode("jenisDetail", r.idJenisDetail),
    jfNama: `${r.jf.namaJf} — ${r.jf.instansi.nama}`,
    instansiNama: r.jf.instansi.nama,
    jfSaja: r.jf.namaJf,
    jenisLabel: `${r.detail.jenis.namaJenis} › ${r.detail.namaDetail}`,
    namaProgram: r.namaProgram,
    kategori: r.kategori ?? "",
    deskripsi: r.deskripsi ?? "",
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

async function assertNamaFree(idJf: bigint, idJenisDetail: bigint, nama: string, exceptId?: bigint) {
  const dup = await db.programBangkom.findFirst({
    where: {
      idJf,
      idJenisDetail,
      namaProgram: { equals: nama, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) {
    throw new AppError("CONFLICT", 409, "Program dengan nama ini sudah ada pada JF dan sub jenis tersebut.", {
      namaProgram: ["Nama sudah dipakai"],
    });
  }
}

/** Baris yang boleh disentuh aktor, atau 404 (anti-IDOR). */
async function findInScope(id: bigint, scope: Scope) {
  const row = await db.programBangkom.findFirst({ where: { id, ...scopeWhere(scope) }, select: { id: true, namaProgram: true } });
  if (!row) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  return row;
}

export async function createProgram(input: ProgramInput, actor: string, scope: Scope) {
  const idJf = await resolveJf(input.jf, scope);
  const idJenisDetail = await resolveDetail(input.jenisDetail);
  await assertNamaFree(idJf, idJenisDetail, input.namaProgram);
  const row = await db.programBangkom.create({
    data: {
      idJf,
      idJenisDetail,
      namaProgram: input.namaProgram,
      deskripsi: input.deskripsi ?? null,
      kategori: input.kategori ?? null,
      statusAktif: input.statusAktif,
      createdBy: actor,
    },
  });
  await audit("create", { entitas: "ProgramBangkom", entitasId: String(row.id), actor, meta: { nama: input.namaProgram } });
  return { id: ids().encode("program", row.id) };
}

export async function updateProgram(token: string, input: ProgramInput, actor: string, scope: Scope) {
  const id = decodeOr404("program", token);
  await findInScope(id, scope);
  const idJf = await resolveJf(input.jf, scope);
  const idJenisDetail = await resolveDetail(input.jenisDetail);
  await assertNamaFree(idJf, idJenisDetail, input.namaProgram, id);
  await db.programBangkom.update({
    where: { id },
    data: {
      idJf,
      idJenisDetail,
      namaProgram: input.namaProgram,
      deskripsi: input.deskripsi ?? null,
      kategori: input.kategori ?? null,
      statusAktif: input.statusAktif,
      updatedBy: actor,
    },
  });
  await audit("update", { entitas: "ProgramBangkom", entitasId: String(id), actor, meta: { nama: input.namaProgram } });
}

export async function removeProgram(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("program", token);
  const current = await findInScope(id, scope);
  conflictIfUsed("Program", [["pelatihan", await db.pelatihan.count({ where: { idProgram: id } })]]);
  await db.programBangkom.delete({ where: { id } });
  await audit("delete", { entitas: "ProgramBangkom", entitasId: String(id), actor, meta: { nama: current.namaProgram } });
}
