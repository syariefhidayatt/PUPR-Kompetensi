import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { JenisRow } from "@/components/master/types";
import type { JenisInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

type Tx = Prisma.TransactionClient;

export async function listJenis(q: string | undefined, page: number, f: Filters = {}) {
  const filterAnd = andOf<Prisma.JenisKompetensiWhereInput>([
    f.nama && { namaJenis: ci(f.nama) },
    f.sub && { details: { some: { namaDetail: ci(f.sub) } } },
    fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean },
  ]);
  const where: Prisma.JenisKompetensiWhereInput = {
    AND: filterAnd,
    ...(q
    ? {
        OR: [
          { namaJenis: { contains: q, mode: "insensitive" } },
          { details: { some: { namaDetail: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {}),
  };
  const [rows, total] = await Promise.all([
    db.jenisKompetensi.findMany({
      where,
      orderBy: { namaJenis: "asc" },
      skip: skip(page),
      take: PAGE_SIZE,
      include: { details: { orderBy: { namaDetail: "asc" } } },
    }),
    db.jenisKompetensi.count({ where }),
  ]);
  const data: JenisRow[] = rows.map((r) => ({
    id: ids().encode("jenis", r.id),
    namaJenis: r.namaJenis,
    statusAktif: r.statusAktif,
    details: r.details.map((d) => ({
      id: ids().encode("jenisDetail", d.id),
      namaDetail: d.namaDetail,
      statusAktif: d.statusAktif,
    })),
  }));
  return { rows: data, total };
}

// ---------- validasi ----------

function assertDetailNamesUnique(details: JenisInput["details"]) {
  const seen = new Set<string>();
  for (const d of details) {
    const key = d.namaDetail.toLowerCase();
    if (seen.has(key)) {
      throw new AppError("CONFLICT", 409, `Sub jenis "${d.namaDetail}" muncul lebih dari sekali.`, {
        details: ["Nama sub jenis harus unik"],
      });
    }
    seen.add(key);
  }
}

async function assertJenisNamaFree(tx: Tx, nama: string, exceptId?: bigint) {
  const dup = await tx.jenisKompetensi.findFirst({
    where: { namaJenis: { equals: nama, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new AppError("CONFLICT", 409, "Nama jenis kompetensi sudah terdaftar.", { namaJenis: ["Nama sudah dipakai"] });
}

/** Sub jenis yang dipakai kompetensi/program tidak boleh dibuang (J2). Menghitung juga baris soft-deleted (FK tetap menahan). */
async function assertDetailsUnused(tx: Tx, detailIds: bigint[]) {
  if (detailIds.length === 0) return;
  const [kompetensi, program] = await Promise.all([
    tx.kompetensi.count({ where: { idJenisDetail: { in: detailIds } } }),
    tx.programBangkom.count({ where: { idJenisDetail: { in: detailIds } } }),
  ]);
  conflictIfUsed("Sub jenis kompetensi", [
    ["kompetensi", kompetensi],
    ["program bangkom", program],
  ]);
}

// ---------- mutasi ----------

export async function createJenis(input: JenisInput, actor: string) {
  assertDetailNamesUnique(input.details);
  const row = await db.$transaction(async (tx) => {
    await assertJenisNamaFree(tx, input.namaJenis);
    return tx.jenisKompetensi.create({
      data: {
        namaJenis: input.namaJenis,
        statusAktif: input.statusAktif,
        createdBy: actor,
        details: { create: input.details.map((d) => ({ namaDetail: d.namaDetail, statusAktif: d.statusAktif })) },
      },
    });
  });
  await audit("create", {
    entitas: "JenisKompetensi",
    entitasId: String(row.id),
    actor,
    meta: { namaJenis: input.namaJenis, jumlahSubJenis: input.details.length },
  });
  return { id: ids().encode("jenis", row.id) };
}

export async function updateJenis(token: string, input: JenisInput, actor: string) {
  const idJenis = decodeOr404("jenis", token);
  assertDetailNamesUnique(input.details);

  await db.$transaction(async (tx) => {
    const current = await tx.jenisKompetensi.findUnique({ where: { id: idJenis }, include: { details: true } });
    if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
    await assertJenisNamaFree(tx, input.namaJenis, idJenis);

    const currentIds = new Set<bigint>(current.details.map((d) => d.id));
    const kept = new Set<bigint>();
    const toUpdate: { id: bigint; namaDetail: string; statusAktif: boolean }[] = [];
    const toCreate: { namaDetail: string; statusAktif: boolean }[] = [];

    for (const d of input.details) {
      if (d.id) {
        const id = ids().decode("jenisDetail", d.id);
        // J1: sub jenis HARUS milik jenis ini. Token milik jenis lain diperlakukan sebagai tidak ada.
        if (id === null || !currentIds.has(id) || kept.has(id)) {
          throw new AppError("NOT_FOUND", 404, "Sub jenis tidak ditemukan pada jenis ini.");
        }
        kept.add(id);
        toUpdate.push({ id, namaDetail: d.namaDetail, statusAktif: d.statusAktif });
      } else {
        toCreate.push({ namaDetail: d.namaDetail, statusAktif: d.statusAktif });
      }
    }

    const removed = [...currentIds].filter((id) => !kept.has(id));
    await assertDetailsUnused(tx, removed); // 409 → transaksi di-rollback, tidak ada yang berubah

    await tx.jenisKompetensi.update({
      where: { id: idJenis },
      data: { namaJenis: input.namaJenis, statusAktif: input.statusAktif, updatedBy: actor },
    });
    if (removed.length > 0) {
      await tx.jenisKompetensiDetail.deleteMany({ where: { id: { in: removed }, idJenis } });
    }
    for (const u of toUpdate) {
      await tx.jenisKompetensiDetail.update({
        where: { id: u.id },
        data: { namaDetail: u.namaDetail, statusAktif: u.statusAktif },
      });
    }
    if (toCreate.length > 0) {
      await tx.jenisKompetensiDetail.createMany({ data: toCreate.map((d) => ({ ...d, idJenis })) });
    }
  });

  await audit("update", {
    entitas: "JenisKompetensi",
    entitasId: String(idJenis),
    actor,
    meta: { namaJenis: input.namaJenis },
  });
}

export async function removeJenis(token: string, actor: string) {
  const idJenis = decodeOr404("jenis", token);

  const nama = await db.$transaction(async (tx) => {
    const current = await tx.jenisKompetensi.findUnique({ where: { id: idJenis }, include: { details: { select: { id: true } } } });
    if (!current) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
    await assertDetailsUnused(tx, current.details.map((d) => d.id));
    await tx.jenisKompetensiDetail.deleteMany({ where: { idJenis } });
    await tx.jenisKompetensi.delete({ where: { id: idJenis } });
    return current.namaJenis;
  });

  await audit("delete", { entitas: "JenisKompetensi", entitasId: String(idJenis), actor, meta: { namaJenis: nama } });
}

/** Opsi dropdown sub jenis ("Jenis › Sub"), dipakai form Kompetensi/Program. */
export async function jenisDetailOptions() {
  const rows = await db.jenisKompetensiDetail.findMany({
    orderBy: [{ jenis: { namaJenis: "asc" } }, { namaDetail: "asc" }],
    select: { id: true, namaDetail: true, statusAktif: true, jenis: { select: { namaJenis: true } } },
  });
  return rows.map((r) => ({
    value: ids().encode("jenisDetail", r.id),
    label: `${r.jenis.namaJenis} › ${r.namaDetail}${r.statusAktif ? "" : " (nonaktif)"}`,
  }));
}
