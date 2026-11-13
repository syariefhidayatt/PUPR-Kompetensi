// Aturan murni batch/peserta (tanpa DB) agar mudah diuji.

/** Batch yang masih menerima pendaftaran peserta. */
export const BATCH_TERBUKA = ["draft", "terjadwal"] as const;

export function batchTerbuka(status: string): boolean {
  return (BATCH_TERBUKA as readonly string[]).includes(status);
}

/** kapasitas 0 = tanpa batas. */
export function sisaKursi(kapasitas: number, terisi: number): number | null {
  return kapasitas === 0 ? null : Math.max(0, kapasitas - terisi);
}

export function penuh(kapasitas: number, terisi: number): boolean {
  return kapasitas > 0 && terisi >= kapasitas;
}

/** Kursi terpakai = peserta aktif di batch (termasuk yang tidak hadir; hapus peserta untuk membebaskan kursi). */
export const KURSI_TERPAKAI = { statusAktif: true } as const;
