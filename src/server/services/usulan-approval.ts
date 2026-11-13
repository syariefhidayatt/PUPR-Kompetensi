import type { Prisma } from "@prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { batchScope } from "./batch";
import { batchTerbuka, KURSI_TERPAKAI, penuh } from "./batch-rules";
import { pegawaiScope } from "./learning-path";
import { decodeOr404 } from "./master/shared";
import { STATUS_BISA_BATAL, rolePrimer } from "./usulan-rules";
import type { Aktor } from "./usulan";

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const invalid = (field: string, msg: string) => new AppError("INVALID", 422, msg, { [field]: [msg] });
const BELUM_DIPUTUS = [...STATUS_BISA_BATAL];

async function usulanDalamScope(token: string, aktor: Aktor) {
  const id = decodeOr404("usulan", token);
  const u = await db.pelatihanUsulan.findFirst({
    where: { id, pegawai: { is: { deletedAt: null, ...pegawaiScope(aktor.scope) } } },
    select: { id: true, idPegawai: true, idPelatihan: true, statusUsulan: true },
  });
  if (!u) throw NOT_FOUND();
  return u;
}

type Tx = Prisma.TransactionClient;

/**
 * Mendaftarkan pegawai ke batch. Baris batch dikunci (FOR UPDATE) sehingga dua persetujuan bersamaan
 * tidak bisa sama-sama lolos cek kapasitas.
 */
async function daftarkan(tx: Tx, u: { id: bigint; idPegawai: bigint; idPelatihan: bigint }, batchToken: string, aktor: Aktor) {
  const idBatch = ids().decode("batch", batchToken);
  if (idBatch === null) throw invalid("batch", "Batch tidak valid.");
  await tx.$queryRaw`SELECT "id" FROM "PelatihanBatch" WHERE "id" = ${idBatch} FOR UPDATE`;
  const b = await tx.pelatihanBatch.findFirst({ where: { id: idBatch, statusAktif: true, ...batchScope(aktor.scope) } });
  if (!b) throw invalid("batch", "Batch tidak valid.");
  if (b.idPelatihan !== u.idPelatihan) throw invalid("batch", "Batch ini bukan untuk pelatihan yang diusulkan.");
  if (!batchTerbuka(b.statusBatch)) throw invalid("batch", `Batch berstatus "${b.statusBatch}" tidak menerima pendaftaran.`);
  const terisi = await tx.pelatihanPesertaBatch.count({ where: { idBatch: b.id, ...KURSI_TERPAKAI } });
  if (penuh(b.kapasitas, terisi)) throw new AppError("CONFLICT", 409, `Kapasitas batch penuh (${terisi}/${b.kapasitas}).`);
  const ada = await tx.pelatihanPesertaBatch.findFirst({ where: { idBatch: b.id, idPegawai: u.idPegawai }, select: { id: true } });
  if (ada) throw new AppError("CONFLICT", 409, "Pegawai sudah terdaftar di batch ini.");
  await tx.pelatihanPesertaBatch.create({
    data: { idBatch: b.id, idPegawai: u.idPegawai, idUsulan: u.id, statusKehadiran: "terdaftar", createdBy: aktor.username },
  });
}

/** Setujui langsung oleh admin. Bila `batch` diisi, peserta langsung didaftarkan (dengan cek kapasitas) dalam satu transaksi. */
export async function setujuiUsulan(token: string, batchToken: string | undefined, aktor: Aktor): Promise<void> {
  const u = await usulanDalamScope(token, aktor);
  if (!BELUM_DIPUTUS.includes(u.statusUsulan as never)) {
    throw new AppError("CONFLICT", 409, `Usulan berstatus "${u.statusUsulan}" tidak dapat disetujui.`);
  }
  await db.$transaction(async (tx) => {
    const r = await tx.pelatihanUsulan.updateMany({
      where: { id: u.id, statusUsulan: { in: BELUM_DIPUTUS } },
      data: { statusUsulan: "disetujui", updatedBy: aktor.username },
    });
    if (r.count === 0) throw new AppError("CONFLICT", 409, "Status usulan sudah berubah; muat ulang halaman.");
    if (batchToken) await daftarkan(tx, u, batchToken, aktor);
  });
  const role = rolePrimer(aktor.roles);
  await audit("usulan.setuju", { entitas: "PelatihanUsulan", entitasId: String(u.id), actor: aktor.username, ...(role ? { actorRole: role } : {}), meta: { batch: Boolean(batchToken) } });
}

/** Untuk usulan yang sudah disetujui tetapi belum punya peserta batch. */
export async function daftarkanKeBatch(token: string, batchToken: string, aktor: Aktor): Promise<void> {
  const u = await usulanDalamScope(token, aktor);
  if (u.statusUsulan !== "disetujui") throw new AppError("CONFLICT", 409, "Hanya usulan yang sudah disetujui yang dapat didaftarkan ke batch.");
  await db.$transaction(async (tx) => {
    const sudah = await tx.pelatihanPesertaBatch.count({ where: { idUsulan: u.id } });
    if (sudah > 0) throw new AppError("CONFLICT", 409, "Usulan ini sudah didaftarkan ke batch.");
    await daftarkan(tx, u, batchToken, aktor);
  });
  await audit("usulan.daftar_batch", { entitas: "PelatihanUsulan", entitasId: String(u.id), actor: aktor.username });
}

export async function tolakUsulan(token: string, alasan: string, aktor: Aktor): Promise<void> {
  const u = await usulanDalamScope(token, aktor);
  const r = await db.pelatihanUsulan.updateMany({
    where: { id: u.id, statusUsulan: { in: BELUM_DIPUTUS } },
    data: { statusUsulan: "ditolak", alasanPenolakan: alasan, updatedBy: aktor.username },
  });
  if (r.count === 0) throw new AppError("CONFLICT", 409, `Usulan berstatus "${u.statusUsulan}" tidak dapat ditolak.`);
  const role = rolePrimer(aktor.roles);
  await audit("usulan.tolak", { entitas: "PelatihanUsulan", entitasId: String(u.id), actor: aktor.username, ...(role ? { actorRole: role } : {}) });
}

/** Batch terbuka (dalam scope) per pelatihan, untuk pilihan di dialog persetujuan. */
export async function batchTerbukaPerPelatihan(aktor: Aktor, idPelatihan: bigint[]) {
  if (idPelatihan.length === 0) return new Map<string, { token: string; label: string }[]>();
  const rows = await db.pelatihanBatch.findMany({
    where: { idPelatihan: { in: idPelatihan }, statusAktif: true, statusBatch: { in: ["draft", "terjadwal"] }, ...batchScope(aktor.scope) },
    orderBy: [{ tanggalMulai: "asc" }],
    include: { _count: { select: { peserta: { where: KURSI_TERPAKAI } } } },
  });
  const map = new Map<string, { token: string; label: string }[]>();
  for (const b of rows) {
    const sisa = b.kapasitas === 0 ? "tanpa batas" : `${b._count.peserta}/${b.kapasitas}`;
    const list = map.get(String(b.idPelatihan)) ?? [];
    list.push({ token: ids().encode("batch", b.id), label: `${b.tahunPelaksanaan} · Angk. ${b.angkatan} · ${b.tanggalMulai.toISOString().slice(0, 10)} (${sisa})${penuh(b.kapasitas, b._count.peserta) ? " — PENUH" : ""}` });
    map.set(String(b.idPelatihan), list);
  }
  return map;
}
