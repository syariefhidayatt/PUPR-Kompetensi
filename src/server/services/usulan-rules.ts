// Aturan murni usulan (tanpa DB) agar mudah diuji.

export const USULAN_STATUS = ["mengusulkan", "diajukan", "disetujui", "ditolak", "dibatalkan"] as const;
export type UsulanStatus = (typeof USULAN_STATUS)[number];

/** Status yang dianggap "hidup": menghalangi usulan ganda (sama dengan indeks parsial uq_usulan_aktif). */
export const STATUS_HIDUP: UsulanStatus[] = ["mengusulkan", "diajukan", "disetujui"];
/** Hanya usulan yang belum diputuskan yang boleh dibatalkan. */
export const STATUS_BISA_BATAL: UsulanStatus[] = ["mengusulkan", "diajukan"];

export const STATUS_LABEL: Record<string, string> = {
  mengusulkan: "Diusulkan",
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

/** Diusulkan sendiri → "mengusulkan"; diajukan admin atas nama pegawai → "diajukan". */
export function statusAwal(untukDiriSendiri: boolean): UsulanStatus {
  return untukDiriSendiri ? "mengusulkan" : "diajukan";
}

export function bisaDibatalkan(status: string): boolean {
  return (STATUS_BISA_BATAL as string[]).includes(status);
}

/** Prasyarat jenjang kosong = semua jenjang boleh. Pegawai tanpa jenjang tidak memenuhi prasyarat yang ada. */
export function prasyaratTerpenuhi(idJenjang: bigint | null, prasyarat: bigint[]): boolean {
  if (prasyarat.length === 0) return true;
  return idJenjang !== null && prasyarat.includes(idJenjang);
}

const ROLE_PRIORITAS = ["admin_pusat", "admin_instansi", "pembina", "pegawai"];
export function rolePrimer(roles: string[]): string | null {
  return ROLE_PRIORITAS.find((r) => roles.includes(r)) ?? roles[0] ?? null;
}

