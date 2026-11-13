// Fungsi murni (tanpa DB) untuk halaman Kebutuhan Pelatihan: memakai aturan Learning Path yang sama (hitungStatus).
import { hitungStatus, jenjangPadaTanggal, type LpJenjang, type LpPelatihan, type LpPenempatan, type LpRiwayat, type LpStatus } from "./learning-path-calc";

export type KbPegawai = { id: bigint; jenjang: LpJenjang; rumpun: string; penempatan: LpPenempatan[] };
export type KbHadir = { idPegawai: bigint; idPelatihan: bigint; tahun: number; tanggalMulai: Date };
export type KbCell = { idPegawai: bigint; idPelatihan: bigint; wajib: boolean; terlewat: boolean; refresh: boolean };

export const KB_LABEL = { wajib: "Wajib sekarang", terlewat: "Terlewat", refresh: "Perlu refresh" } as const;

/** Teks status ringkas untuk satu sel, mis. "Wajib sekarang, Terlewat". */
export function kbTeks(c: Pick<KbCell, "wajib" | "terlewat" | "refresh">): string {
  return (["wajib", "refresh", "terlewat"] as const).filter((k) => c[k]).map((k) => KB_LABEL[k]).join(", ");
}

/**
 * Untuk tiap pegawai × pelatihan: apakah ada kolom jenjang (dalam rumpun pegawai) berstatus wajib_sekarang / terlewat / perlu_refresh.
 * Hanya sel yang butuh (salah satu true) yang dikembalikan. Kolom dibatasi ke rumpun pegawai (urutan hanya bermakna dalam rumpun).
 */
export function hitungKebutuhan(
  pegawai: KbPegawai[],
  kolomByRumpun: Map<string, LpJenjang[]>,
  pelatihan: LpPelatihan[],
  hadir: KbHadir[],
  tahun: number,
): KbCell[] {
  const hadirByPegawai = new Map<string, KbHadir[]>();
  for (const h of hadir) {
    const k = String(h.idPegawai);
    hadirByPegawai.set(k, [...(hadirByPegawai.get(k) ?? []), h]);
  }
  const out: KbCell[] = [];
  for (const pg of pegawai) {
    const kolom = kolomByRumpun.get(pg.rumpun) ?? [];
    const riwayat: LpRiwayat[] = (hadirByPegawai.get(String(pg.id)) ?? []).map((h) => ({
      idPelatihan: h.idPelatihan,
      tahun: h.tahun,
      idJenjang: jenjangPadaTanggal(pg.penempatan, h.tanggalMulai, pg.jenjang.id),
    }));
    for (const p of pelatihan) {
      const st = new Set<LpStatus>(kolom.map((k) => hitungStatus(p, k, pg.jenjang, riwayat, tahun)));
      const c = { wajib: st.has("wajib_sekarang"), terlewat: st.has("terlewat"), refresh: st.has("perlu_refresh") };
      if (c.wajib || c.terlewat || c.refresh) out.push({ idPegawai: pg.id, idPelatihan: p.id, ...c });
    }
  }
  return out;
}
