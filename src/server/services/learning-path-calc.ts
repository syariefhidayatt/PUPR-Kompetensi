// Fungsi murni (tanpa DB) — port aturan warna fungsi lama ke status semantik. Wajib diuji per baris aturan.

export type LpStatus = "selesai" | "perlu_refresh" | "tidak_berlaku" | "terlewat" | "wajib_sekarang" | "akan_datang";

export type LpJenjang = { id: bigint; nama: string; urutan: number };
export type LpPelatihan = {
  id: bigint;
  nama: string;
  kategori: string | null;
  sertifikat: boolean;
  isRefreshment: boolean;
  kRefreshment: number | null;
  jenjang: bigint[]; // jenjang tempat pelatihan berlaku
};
/** Satu kehadiran (hadir/selesai) yang sudah dipetakan ke jenjang pegawai SAAT pelatihan itu diikuti. */
export type LpRiwayat = { idPelatihan: bigint; idJenjang: bigint; tahun: number };

/**
 * Urutan aturan mengikuti tabel rancangan:
 * 1) sudah diikuti di jenjang ini → selesai, atau perlu_refresh bila refreshment jatuh tempo DAN jenjang ini = jenjang sekarang;
 * 2) tidak berlaku di jenjang ini → tidak_berlaku;
 * 3) berlaku & belum diikuti → bandingkan urutan jenjang kolom dengan jenjang sekarang (terlewat / wajib_sekarang / akan_datang).
 * Perbandingan `urutan` hanya bermakna dalam satu rumpun: pemanggil harus membatasi kolom ke rumpun jenjang sekarang.
 */
export function hitungStatus(
  p: LpPelatihan,
  kolom: LpJenjang,
  sekarang: LpJenjang,
  riwayat: LpRiwayat[],
  tahun: number,
): LpStatus {
  const ikut = riwayat.filter((r) => r.idPelatihan === p.id && r.idJenjang === kolom.id);
  if (ikut.length > 0) {
    const terakhir = Math.max(...ikut.map((r) => r.tahun));
    const jatuhTempo = p.isRefreshment && p.kRefreshment !== null && terakhir + p.kRefreshment <= tahun;
    return jatuhTempo && kolom.id === sekarang.id ? "perlu_refresh" : "selesai";
  }
  if (!p.jenjang.includes(kolom.id)) return "tidak_berlaku";
  if (kolom.urutan < sekarang.urutan) return "terlewat";
  if (kolom.urutan === sekarang.urutan) return "wajib_sekarang";
  return "akan_datang";
}

export type LpRow = { id: string; nama: string; kategori: string | null; sertifikat: boolean; cells: LpStatus[] };
export type LpSummary = Record<LpStatus, number>;

export function buildLearningPath(
  kolom: LpJenjang[],
  sekarang: LpJenjang,
  pelatihan: LpPelatihan[],
  riwayat: LpRiwayat[],
  tahun: number,
): { rows: LpRow[]; summary: LpSummary } {
  const summary: LpSummary = { selesai: 0, perlu_refresh: 0, tidak_berlaku: 0, terlewat: 0, wajib_sekarang: 0, akan_datang: 0 };
  const rows = pelatihan.map((p) => {
    const cells = kolom.map((k) => hitungStatus(p, k, sekarang, riwayat, tahun));
    for (const c of cells) summary[c]++;
    return { id: String(p.id), nama: p.nama, kategori: p.kategori, sertifikat: p.sertifikat, cells };
  });
  return { rows, summary };
}

export type LpPenempatan = { idJenjang: bigint | null; tglMulai: Date; tglSelesai: Date | null };

/** Jenjang pegawai pada suatu tanggal (riwayat penempatan, LP3). Tanpa data yang cocok → `fallback` (jenjang sekarang). */
export function jenjangPadaTanggal(riwayat: LpPenempatan[], tanggal: Date, fallback: bigint): bigint {
  const t = tanggal.getTime();
  const cocok = riwayat
    .filter((r) => r.idJenjang !== null && r.tglMulai.getTime() <= t && (r.tglSelesai === null || r.tglSelesai.getTime() >= t))
    .sort((a, b) => b.tglMulai.getTime() - a.tglMulai.getTime())[0];
  return cocok?.idJenjang ?? fallback;
}
