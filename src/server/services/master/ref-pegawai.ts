import type { Prisma } from "@prisma/client";
import type { MasterRow } from "@/components/master/types";
import { andOf, ci, fAktif, type Filters } from "@/lib/filters";
import type { RefInput } from "@/lib/schemas/ref-pegawai";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

export type RefKind = "golongan" | "pendidikan" | "statusPegawai";

type Row = { id: bigint; nama: string; statusAktif: boolean };
type Repo = {
  findMany(a: { where?: object; orderBy?: object; skip?: number; take?: number }): Promise<Row[]>;
  count(a: { where?: object }): Promise<number>;
  findFirst(a: { where: object; select?: object }): Promise<Row | null>;
  create(a: { data: { nama: string; statusAktif: boolean } }): Promise<Row>;
  update(a: { where: { id: bigint }; data: { nama: string; statusAktif: boolean } }): Promise<Row>;
  delete(a: { where: { id: bigint } }): Promise<Row>;
};

// Pegawai menyimpan NAMA referensi (teks). `pakai` menghitung pemakai; `ganti` memperbarui teks saat nama diubah.
const CFG: Record<RefKind, { label: string; repo: () => Repo; pakai: (nama: string) => Promise<[string, number][]>; ganti: (tx: Prisma.TransactionClient, lama: string, baru: string) => Promise<unknown> }> = {
  golongan: {
    label: "Golongan",
    repo: () => db.golongan as unknown as Repo,
    pakai: async (n) => [["pegawai", await db.pegawai.count({ where: { golongan: { equals: n, mode: "insensitive" } } })]],
    ganti: (tx, lama, baru) => tx.pegawai.updateMany({ where: { golongan: { equals: lama, mode: "insensitive" } }, data: { golongan: baru } }),
  },
  pendidikan: {
    label: "Pendidikan",
    repo: () => db.pendidikan as unknown as Repo,
    pakai: async (n) => [["pegawai", await db.pegawai.count({ where: { pendidikan: { equals: n, mode: "insensitive" } } })]],
    ganti: (tx, lama, baru) => tx.pegawai.updateMany({ where: { pendidikan: { equals: lama, mode: "insensitive" } }, data: { pendidikan: baru } }),
  },
  statusPegawai: {
    label: "Status pegawai",
    repo: () => db.statusPegawai as unknown as Repo,
    pakai: async (n) => [["penempatan pegawai", await db.pegawaiPenempatan.count({ where: { statusPegawai: { equals: n, mode: "insensitive" } } })]],
    ganti: (tx, lama, baru) => tx.pegawaiPenempatan.updateMany({ where: { statusPegawai: { equals: lama, mode: "insensitive" } }, data: { statusPegawai: baru } }),
  },
};

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

export async function listRef(kind: RefKind, q: string | undefined, page: number, f: Filters = {}) {
  const where = {
    ...(q ? { nama: { contains: q, mode: "insensitive" } } : {}),
    AND: andOf<{ nama?: Prisma.StringFilter; statusAktif?: boolean }>([f.nama && { nama: ci(f.nama) }, fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean }]),
  };
  const repo = CFG[kind].repo();
  const [rows, total] = await Promise.all([repo.findMany({ where, orderBy: { nama: "asc" }, skip: skip(page), take: PAGE_SIZE }), repo.count({ where })]);
  const data: MasterRow[] = rows.map((r) => ({ id: ids().encode(kind, r.id), nama: r.nama, statusAktif: r.statusAktif }));
  return { rows: data, total };
}

/** Opsi dropdown (form pegawai): hanya yang aktif; `value` = nama (yang disimpan di pegawai). */
export async function refOptions(kind: RefKind, termasuk?: string | null) {
  const rows = await CFG[kind].repo().findMany({ where: { OR: [{ statusAktif: true }, ...(termasuk ? [{ nama: { equals: termasuk, mode: "insensitive" } }] : [])] }, orderBy: { nama: "asc" } });
  return rows.map((r) => ({ value: r.nama, label: r.statusAktif ? r.nama : `${r.nama} (nonaktif)` }));
}

async function assertNamaFree(kind: RefKind, nama: string, exceptId?: bigint) {
  const dup = await CFG[kind].repo().findFirst({ where: { nama: { equals: nama, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new AppError("CONFLICT", 409, `${CFG[kind].label} dengan nama ini sudah ada.`, { nama: ["Nama sudah dipakai"] });
}

export async function createRef(kind: RefKind, input: RefInput, actor: string) {
  await assertNamaFree(kind, input.nama);
  const row = await CFG[kind].repo().create({ data: { nama: input.nama, statusAktif: input.statusAktif } });
  await audit("create", { entitas: CFG[kind].label, entitasId: String(row.id), actor, meta: { nama: input.nama } });
  return { id: ids().encode(kind, row.id) };
}

export async function updateRef(kind: RefKind, token: string, input: RefInput, actor: string) {
  const id = decodeOr404(kind, token);
  const cur = await CFG[kind].repo().findFirst({ where: { id } });
  if (!cur) throw NOT_FOUND();
  await assertNamaFree(kind, input.nama, id);
  // Ganti nama + perbarui teks di pegawai dalam satu transaksi agar tidak ada data yatim.
  await db.$transaction(async (tx) => {
    await (tx as unknown as Record<RefKind, Repo>)[kind].update({ where: { id }, data: { nama: input.nama, statusAktif: input.statusAktif } });
    if (cur.nama !== input.nama) await CFG[kind].ganti(tx, cur.nama, input.nama);
  });
  await audit("update", { entitas: CFG[kind].label, entitasId: String(id), actor, meta: { nama: input.nama } });
}

export async function removeRef(kind: RefKind, token: string, actor: string) {
  const id = decodeOr404(kind, token);
  const cur = await CFG[kind].repo().findFirst({ where: { id } });
  if (!cur) throw NOT_FOUND();
  conflictIfUsed(CFG[kind].label, await CFG[kind].pakai(cur.nama));
  await CFG[kind].repo().delete({ where: { id } });
  await audit("delete", { entitas: CFG[kind].label, entitasId: String(id), actor, meta: { nama: cur.nama } });
}
