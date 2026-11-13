import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { sisaKursi } from "./batch-rules";
import { pegawaiScope } from "./learning-path";
import { jfOptions } from "./master/jf";
import { viaJfScope } from "./master/refs";
import { decodeOr404 } from "./master/shared";
import { batalkanUsulan, createUsulan, type Aktor } from "./usulan";
import { batchTerbukaPerPelatihan, setujuiUsulan } from "./usulan-approval";
import { STATUS_HIDUP, prasyaratTerpenuhi } from "./usulan-rules";

export const MAKS_PEGAWAI_USULAN = 200;
const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

export type OpsiUsulanBatch = {
  jf: { value: string; label: string }[];
  pelatihan: { token: string; jf: string; label: string; batch: { token: string; label: string }[] }[];
};

/** Pilihan form "Usulkan Pegawai": JF → pelatihan aktif → batch yang masih terbuka. Semua dibatasi scope aktor. */
export async function opsiUsulanBatch(aktor: Aktor): Promise<OpsiUsulanBatch> {
  const [jf, pel] = await Promise.all([
    jfOptions(aktor.scope),
    db.pelatihan.findMany({
      where: { deletedAt: null, statusAktif: true, program: { deletedAt: null, statusAktif: true, ...(viaJfScope(aktor.scope) as Prisma.ProgramBangkomWhereInput) } },
      orderBy: { namaPelatihan: "asc" },
      select: { id: true, namaPelatihan: true, program: { select: { idJf: true } } },
    }),
  ]);
  const batch = await batchTerbukaPerPelatihan(aktor, pel.map((p) => p.id));
  return {
    jf,
    pelatihan: pel
      .map((p) => ({ token: ids().encode("pelatihan", p.id), jf: ids().encode("jf", p.program.idJf), label: p.namaPelatihan, batch: batch.get(String(p.id)) ?? [] }))
      .filter((p) => p.batch.length > 0), // tanpa batch terbuka tidak ada yang bisa didaftarkan
  };
}

async function pelatihanDalamScope(aktor: Aktor, token: string) {
  const id = decodeOr404("pelatihan", token);
  const p = await db.pelatihan.findFirst({
    where: { id, deletedAt: null, statusAktif: true, program: { deletedAt: null, statusAktif: true, ...(viaJfScope(aktor.scope) as Prisma.ProgramBangkomWhereInput) } },
    select: { id: true, program: { select: { idJf: true } }, jenjang: { select: { idJenjang: true } } },
  });
  if (!p) throw NOT_FOUND();
  return p;
}

export type PegawaiLayak = { token: string; nama: string; nip: string; jenjang: string };

/** Pegawai yang layak diusulkan: penempatan aktif di JF pelatihan, prasyarat jenjang terpenuhi, belum ada usulan hidup. */
export async function pegawaiLayak(aktor: Aktor, pelatihanToken: string): Promise<PegawaiLayak[]> {
  const pel = await pelatihanDalamScope(aktor, pelatihanToken);
  const syarat = pel.jenjang.map((j) => j.idJenjang);
  const rows = await db.pegawai.findMany({
    where: {
      deletedAt: null,
      ...pegawaiScope(aktor.scope),
      penempatan: { some: { tglSelesai: null, idJf: pel.program.idJf, idJenjang: { not: null } } },
      usulan: { none: { idPelatihan: pel.id, statusUsulan: { in: STATUS_HIDUP } } },
    },
    orderBy: { nama: "asc" },
    take: 1000,
    select: { id: true, nama: true, nip: true, penempatan: { where: { tglSelesai: null, idJf: pel.program.idJf }, take: 1, select: { idJenjang: true, jenjang: { select: { nama: true } } } } },
  });
  return rows
    .filter((r) => prasyaratTerpenuhi(r.penempatan[0]?.idJenjang ?? null, syarat))
    .map((r) => ({ token: ids().encode("pegawai", r.id), nama: r.nama, nip: r.nip, jenjang: r.penempatan[0]?.jenjang?.nama ?? "" }));
}

export type HasilUsulanBatch = { berhasil: number; gagal: { nama: string; pesan: string }[] };

/**
 * Usulkan banyak pegawai sekaligus & langsung daftarkan ke batch (persetujuan admin satu langkah).
 * Tiap pegawai diproses terpisah: yang gagal dilaporkan, yang berhasil tetap tersimpan.
 * Usulan yang gagal didaftarkan ke batch dibatalkan agar tidak menggantung.
 */
export async function usulkanBanyak(aktor: Aktor, input: { pelatihan: string; batch: string; pegawai: string[] }): Promise<HasilUsulanBatch> {
  const unik = [...new Set(input.pegawai)];
  if (unik.length === 0) throw new AppError("INVALID", 422, "Pilih minimal satu pegawai.", { pegawai: ["Pilih minimal satu pegawai."] });
  if (unik.length > MAKS_PEGAWAI_USULAN) throw new AppError("INVALID", 422, `Maksimal ${MAKS_PEGAWAI_USULAN} pegawai sekali usul.`, { pegawai: [`Maksimal ${MAKS_PEGAWAI_USULAN} pegawai.`] });
  const pel = await pelatihanDalamScope(aktor, input.pelatihan);

  // Cek awal kapasitas agar tidak membuat usulan yang pasti gagal. Cek final tetap di setujuiUsulan (dengan kunci baris).
  const idBatch = decodeOr404("batch", input.batch);
  const b = await db.pelatihanBatch.findFirst({
    where: { id: idBatch, idPelatihan: pel.id, statusAktif: true, statusBatch: { in: ["draft", "terjadwal"] } },
    select: { kapasitas: true, _count: { select: { peserta: { where: { statusAktif: true } } } } },
  });
  if (!b) throw new AppError("INVALID", 422, "Batch tidak valid atau sudah tidak menerima pendaftaran.", { batch: ["Batch tidak valid."] });
  const sisa = sisaKursi(b.kapasitas, b._count.peserta);
  if (sisa !== null && unik.length > sisa) {
    throw new AppError("CONFLICT", 409, `Sisa kursi batch ${sisa}, sedangkan ${unik.length} pegawai dipilih.`);
  }

  const hasil: HasilUsulanBatch = { berhasil: 0, gagal: [] };
  for (const token of unik) {
    let usulan: string | null = null;
    try {
      usulan = (await createUsulan({ pelatihan: input.pelatihan, pegawai: token }, aktor)).token;
      await setujuiUsulan(usulan, input.batch, aktor);
      hasil.berhasil++;
    } catch (e) {
      if (usulan) await batalkanUsulan(usulan, aktor).catch(() => undefined);
      if (!(e instanceof AppError)) throw e; // error tak terduga: hentikan, jangan disamarkan
      const id = ids().decode("pegawai", token);
      const p = id === null ? null : await db.pegawai.findUnique({ where: { id }, select: { nama: true } });
      hasil.gagal.push({ nama: p?.nama ?? "Pegawai", pesan: e.message });
    }
  }
  return hasil;
}

/**
 * Usulkan banyak pegawai ke satu pelatihan TANPA memilih batch: hanya membuat usulan (status "diajukan").
 * Persetujuan & penentuan batch dilakukan kemudian di halaman Usulan Pelatihan.
 */
export async function usulkanTanpaBatch(aktor: Aktor, input: { pelatihan: string; pegawai: string[] }): Promise<HasilUsulanBatch> {
  const unik = [...new Set(input.pegawai)];
  if (unik.length === 0) throw new AppError("INVALID", 422, "Pilih minimal satu pegawai.", { pegawai: ["Pilih minimal satu pegawai."] });
  if (unik.length > MAKS_PEGAWAI_USULAN) throw new AppError("INVALID", 422, `Maksimal ${MAKS_PEGAWAI_USULAN} pegawai sekali usul.`);
  await pelatihanDalamScope(aktor, input.pelatihan); // di luar scope = 404

  const hasil: HasilUsulanBatch = { berhasil: 0, gagal: [] };
  for (const token of unik) {
    try {
      await createUsulan({ pelatihan: input.pelatihan, pegawai: token }, aktor);
      hasil.berhasil++;
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      const id = ids().decode("pegawai", token);
      const p = id === null ? null : await db.pegawai.findUnique({ where: { id }, select: { nama: true } });
      hasil.gagal.push({ nama: p?.nama ?? "Pegawai", pesan: e.message });
    }
  }
  return hasil;
}
