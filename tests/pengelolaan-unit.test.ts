import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { pilihAktif } from "@/components/nav-active";
import {
  isFormat,
  pdfSafe,
  tableToPdf,
  tableToXlsx,
  type TableData,
} from "@/server/export/table-export";
import { hitungKebutuhan, kbTeks, type KbPegawai } from "@/server/services/pengelolaan-calc";

const J = {
  pertama: { id: 1n, nama: "Pertama", urutan: 1 },
  muda: { id: 2n, nama: "Muda", urutan: 2 },
  madya: { id: 3n, nama: "Madya", urutan: 3 },
};
const kolom = new Map([["KEAHLIAN", [J.pertama, J.muda, J.madya]]]);
const pel = (
  id: bigint,
  jenjang: bigint[],
  extra: Partial<{ isRefreshment: boolean; kRefreshment: number | null }> = {},
) => ({
  id,
  nama: `P${id}`,
  kategori: null,
  sertifikat: false,
  isRefreshment: false,
  kRefreshment: null,
  jenjang,
  ...extra,
});
const pegawai = (id: bigint, jenjang = J.muda): KbPegawai => ({
  id,
  rumpun: "KEAHLIAN",
  jenjang,
  penempatan: [{ idJenjang: jenjang.id, tglMulai: new Date("2020-01-01"), tglSelesai: null }],
});

describe("hitungKebutuhan", () => {
  it("wajib sekarang di jenjang sendiri, terlewat di jenjang bawah, akan_datang tidak dihitung", () => {
    const r = hitungKebutuhan(
      [pegawai(1n)],
      kolom,
      [pel(10n, [2n]), pel(11n, [1n]), pel(12n, [3n])],
      [],
      2026,
    );
    expect(r.find((c) => c.idPelatihan === 10n)).toMatchObject({ wajib: true, terlewat: false });
    expect(r.find((c) => c.idPelatihan === 11n)).toMatchObject({ wajib: false, terlewat: true });
    expect(r.find((c) => c.idPelatihan === 12n)).toBeUndefined();
  });

  it("yang sudah diikuti pada jenjangnya tidak lagi dibutuhkan", () => {
    const hadir = [
      { idPegawai: 1n, idPelatihan: 10n, tahun: 2024, tanggalMulai: new Date("2024-03-01") },
    ];
    expect(hitungKebutuhan([pegawai(1n)], kolom, [pel(10n, [2n])], hadir, 2026)).toEqual([]);
  });

  it("refreshment jatuh tempo → perlu refresh", () => {
    const hadir = [
      { idPegawai: 1n, idPelatihan: 10n, tahun: 2022, tanggalMulai: new Date("2022-03-01") },
    ];
    const r = hitungKebutuhan(
      [pegawai(1n)],
      kolom,
      [pel(10n, [2n], { isRefreshment: true, kRefreshment: 3 })],
      hadir,
      2026,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ refresh: true, wajib: false });
  });

  it("kehadiran lama dihitung pada jenjang saat itu (pegawai sudah naik jenjang)", () => {
    const pg: KbPegawai = {
      id: 1n,
      rumpun: "KEAHLIAN",
      jenjang: J.muda,
      penempatan: [
        { idJenjang: 1n, tglMulai: new Date("2018-01-01"), tglSelesai: new Date("2021-12-31") },
        { idJenjang: 2n, tglMulai: new Date("2022-01-01"), tglSelesai: null },
      ],
    };
    const hadir = [
      { idPegawai: 1n, idPelatihan: 10n, tahun: 2020, tanggalMulai: new Date("2020-05-01") },
    ];
    const r = hitungKebutuhan([pg], kolom, [pel(10n, [1n, 2n])], hadir, 2026);
    // Pertama sudah diikuti; Muda (jenjang sekarang) belum → wajib sekarang.
    expect(r[0]).toMatchObject({ wajib: true, terlewat: false });
  });

  it("rumpun tanpa kolom tidak menghasilkan apa pun", () => {
    const pg: KbPegawai = { ...pegawai(1n), rumpun: "KETERAMPILAN" };
    expect(hitungKebutuhan([pg], kolom, [pel(10n, [2n])], [], 2026)).toEqual([]);
  });

  it("kbTeks menggabung label", () => {
    expect(kbTeks({ wajib: true, terlewat: true, refresh: false })).toBe(
      "Wajib sekarang, Terlewat",
    );
  });
});

const tabel: TableData = {
  title: "Rekap Uji",
  subtitle: "Filter: tahun=2026",
  summary: [["Total", "2"]],
  columns: [{ header: "No", align: "center" }, { header: "Nama" }],
  rows: [
    [1, '=HYPERLINK("http://x")'],
    [2, "Budi – “Jr”\nbaris dua"],
  ],
};

describe("ekspor tabel", () => {
  it("isFormat hanya menerima xlsx/pdf", () => {
    expect(isFormat("xlsx")).toBe(true);
    expect(isFormat("pdf")).toBe(true);
    expect(isFormat("csv")).toBe(false);
    expect(isFormat(null)).toBe(false);
  });

  it("xlsx: header, baris, dan sel berawalan '=' tetap teks (bukan rumus)", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await tableToXlsx(tabel)) as any);
    const ws = wb.worksheets[0]!;
    expect(ws.getCell(1, 1).value).toBe("Rekap Uji");
    const barisHeader = [1, 2, 3, 4, 5].find((r) => ws.getCell(r, 2).value === "Nama")!;
    expect(barisHeader).toBeDefined();
    const sel = ws.getCell(barisHeader + 1, 2);
    expect(typeof sel.value).toBe("string");
    expect(sel.formula).toBeUndefined();
  });

  it("pdf: menghasilkan berkas PDF valid dan tidak error pada karakter non-Latin", () => {
    const buf = tableToPdf({ ...tabel, rows: [...tabel.rows, [3, "日本語 ★"]] }, "Dicetak uji");
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("pdf: ribuan baris tetap jadi banyak halaman", () => {
    const besar: TableData = {
      ...tabel,
      rows: Array.from({ length: 800 }, (_, i) => [i + 1, `Pegawai ${i}`]),
    };
    const buf = tableToPdf(besar, "uji");
    expect((buf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThan(5);
  });

  it("pdfSafe mengganti karakter di luar Latin-1", () => {
    expect(pdfSafe("A – B “C”…")).toBe('A - B "C"...');
    expect(pdfSafe("日本")).toBe("??");
    expect(pdfSafe("é")).toBe("é");
  });
});

describe("menu Pengelolaan", () => {
  it("rute ekspor tidak membuat dua menu aktif", () => {
    const hrefs = ["/pengelolaan/kebutuhan", "/pengelolaan/kehadiran", "/pengelolaan/rekap"];
    expect(pilihAktif("/pengelolaan/kehadiran/abc", hrefs)).toBe("/pengelolaan/kehadiran");
    expect(pilihAktif("/pengelolaan/rekap", hrefs)).toBe("/pengelolaan/rekap");
  });
});
