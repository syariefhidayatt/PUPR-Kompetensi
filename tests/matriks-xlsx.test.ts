import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildMatriks } from "@/server/services/matriks-build";
import { buildMatriksWorkbook, teksSel } from "@/server/services/matriks-xlsx";
import { unitKerjaSchema, unitOrganisasiSchema } from "@/lib/schemas/unit";

const data = buildMatriks(
  [
    { id: 1n, nama: "Kompetensi A", jenis: "Teknis", subJenis: "Umum" },
    { id: 2n, nama: "=Kompetensi B", jenis: "Teknis", subJenis: "Umum" },
  ],
  [
    { id: 10n, nama: "Pertama", rumpun: "Keahlian" },
    { id: 11n, nama: "Muda", rumpun: "Keahlian" },
  ],
  [{ id: 100n, nama: "Pelatihan X", kategori: "Dasar", sertifikat: true, kompetensi: [1n], jenjang: [10n] }],
);

describe("ekspor matriks xlsx", () => {
  it("teks sel: bernomor, kategori, tanda sertifikat", () => {
    expect(teksSel(data.rows[0]!.cells[0]!)).toBe("1. Pelatihan X [Dasar] ★");
    expect(teksSel([])).toBe("");
  });

  it("file dapat dibaca ulang: header, baris, sel kosong, gap, filter", async () => {
    const buf = await buildMatriksWorkbook(data, "Perencana — Instansi A", false);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Matriks")!;
    expect(String(ws.getCell(1, 1).value)).toContain("Perencana — Instansi A");
    expect(ws.getRow(4).values).toEqual([undefined, "No", "Jenis", "Sub jenis", "Kompetensi", "Pertama", "Muda"]);
    expect(ws.getCell(5, 4).value).toBe("Kompetensi A");
    expect(ws.getCell(5, 5).value).toBe("1. Pelatihan X [Dasar] ★");
    expect(ws.getCell(5, 6).value).toBe("—");
    expect(String(ws.getCell(6, 4).value)).toContain("BELUM ADA PELATIHAN");
    // Nilai berawalan "=" tetap string biasa (bukan rumus) di xlsx.
    expect(typeof ws.getCell(6, 4).value).toBe("string");
  });

  it("matriks tanpa baris tetap menghasilkan file valid", async () => {
    const buf = await buildMatriksWorkbook(buildMatriks([], [], []), "Kosong", false);
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe("skema unit", () => {
  it("unit organisasi: kode & nama wajib; kode kosong ditolak", () => {
    expect(unitOrganisasiSchema.safeParse({ instansi: "a", kode: "UO1", nama: "Biro Umum", statusAktif: "on" }).success).toBe(true);
    expect(unitOrganisasiSchema.safeParse({ instansi: "a", kode: " ", nama: "Biro Umum" }).success).toBe(false);
    expect(unitOrganisasiSchema.safeParse({ instansi: "", kode: "UO1", nama: "Biro Umum" }).success).toBe(false);
  });
  it("unit kerja: unit organisasi opsional (kosong → undefined)", () => {
    const r = unitKerjaSchema.parse({ instansi: "a", unitOrganisasi: "", kode: "UK1", nama: "Satker Satu" });
    expect(r.unitOrganisasi).toBeUndefined();
    expect(unitKerjaSchema.safeParse({ instansi: "a", unitOrganisasi: "x", kode: "UK1", nama: "ab" }).success).toBe(false);
  });
});
