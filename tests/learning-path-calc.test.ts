import { describe, expect, it } from "vitest";
import {
  buildLearningPath,
  hitungStatus,
  jenjangPadaTanggal,
  type LpJenjang,
  type LpPelatihan,
  type LpRiwayat,
} from "@/server/services/learning-path-calc";

const J1: LpJenjang = { id: 1n, nama: "Pertama", urutan: 1 };
const J2: LpJenjang = { id: 2n, nama: "Muda", urutan: 2 };
const J3: LpJenjang = { id: 3n, nama: "Madya", urutan: 3 };
const pel = (over: Partial<LpPelatihan> = {}): LpPelatihan => ({
  id: 100n, nama: "P", kategori: null, sertifikat: false, isRefreshment: false, kRefreshment: null, jenjang: [1n, 2n, 3n], ...over,
});
const ikut = (idJenjang: bigint, tahun: number, idPelatihan = 100n): LpRiwayat => ({ idPelatihan, idJenjang, tahun });

describe("hitungStatus — satu uji per baris aturan", () => {
  const now = J2; // pegawai berada di jenjang Muda
  it("selesai: sudah diikuti di jenjang ini, tanpa refreshment", () => {
    expect(hitungStatus(pel(), J1, now, [ikut(1n, 2020)], 2026)).toBe("selesai");
  });
  it("selesai: refreshment belum jatuh tempo", () => {
    expect(hitungStatus(pel({ isRefreshment: true, kRefreshment: 5 }), J2, now, [ikut(2n, 2023)], 2026)).toBe("selesai");
  });
  it("perlu_refresh: sudah diikuti, interval terlewati, dan jenjang kolom = jenjang sekarang", () => {
    expect(hitungStatus(pel({ isRefreshment: true, kRefreshment: 3 }), J2, now, [ikut(2n, 2023)], 2026)).toBe("perlu_refresh");
  });
  it("selesai (bukan perlu_refresh): interval terlewati tetapi jenjang kolom bukan jenjang sekarang", () => {
    expect(hitungStatus(pel({ isRefreshment: true, kRefreshment: 1 }), J1, now, [ikut(1n, 2020)], 2026)).toBe("selesai");
  });
  it("memakai kehadiran TERAKHIR pada jenjang itu untuk menghitung jatuh tempo", () => {
    const p = pel({ isRefreshment: true, kRefreshment: 3 });
    expect(hitungStatus(p, J2, now, [ikut(2n, 2020), ikut(2n, 2025)], 2026)).toBe("selesai");
  });
  it("tidak_berlaku: pelatihan tidak ada di jenjang itu dan belum diikuti", () => {
    expect(hitungStatus(pel({ jenjang: [1n] }), J3, now, [], 2026)).toBe("tidak_berlaku");
  });
  it("terlewat: berlaku, jenjang kolom < jenjang sekarang, belum diikuti", () => {
    expect(hitungStatus(pel(), J1, now, [], 2026)).toBe("terlewat");
  });
  it("wajib_sekarang: berlaku, jenjang kolom = jenjang sekarang, belum diikuti", () => {
    expect(hitungStatus(pel(), J2, now, [], 2026)).toBe("wajib_sekarang");
  });
  it("akan_datang: berlaku, jenjang kolom > jenjang sekarang, belum diikuti", () => {
    expect(hitungStatus(pel(), J3, now, [], 2026)).toBe("akan_datang");
  });
  it("riwayat pelatihan lain / jenjang lain tidak ikut dihitung", () => {
    expect(hitungStatus(pel(), J2, now, [ikut(2n, 2024, 999n), ikut(1n, 2024)], 2026)).toBe("wajib_sekarang");
  });
  it("refreshment tanpa interval tidak pernah jatuh tempo", () => {
    expect(hitungStatus(pel({ isRefreshment: true, kRefreshment: null }), J2, now, [ikut(2n, 1999)], 2026)).toBe("selesai");
  });
});

describe("buildLearningPath", () => {
  it("jumlah kolom dinamis dan ringkasan menghitung semua sel", () => {
    const { rows, summary } = buildLearningPath([J1, J2, J3], J2, [pel(), pel({ id: 101n, jenjang: [1n] })], [ikut(1n, 2020, 101n)], 2026);
    expect(rows[0]!.cells).toEqual(["terlewat", "wajib_sekarang", "akan_datang"]);
    expect(rows[1]!.cells).toEqual(["selesai", "tidak_berlaku", "tidak_berlaku"]);
    expect(summary).toEqual({ selesai: 1, perlu_refresh: 0, tidak_berlaku: 2, terlewat: 1, wajib_sekarang: 1, akan_datang: 1 });
  });
  it("tanpa pelatihan → tanpa baris", () => {
    expect(buildLearningPath([J1], J1, [], [], 2026).rows).toEqual([]);
  });
});

describe("jenjangPadaTanggal", () => {
  const d = (s: string) => new Date(s);
  const riwayat = [
    { idJenjang: 1n, tglMulai: d("2020-01-01"), tglSelesai: d("2022-12-31") },
    { idJenjang: 2n, tglMulai: d("2023-01-01"), tglSelesai: null },
  ];
  it("memilih jenjang yang berlaku pada tanggal itu", () => {
    expect(jenjangPadaTanggal(riwayat, d("2021-06-01"), 9n)).toBe(1n);
    expect(jenjangPadaTanggal(riwayat, d("2024-06-01"), 9n)).toBe(2n);
    expect(jenjangPadaTanggal(riwayat, d("2022-12-31"), 9n)).toBe(1n); // batas inklusif
  });
  it("di luar riwayat → fallback jenjang sekarang", () => {
    expect(jenjangPadaTanggal(riwayat, d("2019-01-01"), 9n)).toBe(9n);
    expect(jenjangPadaTanggal([{ idJenjang: null, tglMulai: d("2020-01-01"), tglSelesai: null }], d("2021-01-01"), 9n)).toBe(9n);
  });
});
