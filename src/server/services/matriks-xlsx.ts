import ExcelJS from "exceljs";
import type { MatriksData } from "./matriks-build";

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2744" } } as const;
const GAP_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } } as const;

/** Baris pelatihan dalam satu sel: "1. Nama [Kategori] ★". */
export function teksSel(items: MatriksData["rows"][number]["cells"][number]): string {
  return items.map((p, i) => `${i + 1}. ${p.nama}${p.kategori ? ` [${p.kategori}]` : ""}${p.sertifikat ? " ★" : ""}`).join("\n");
}

/** Matriks Kompetensi × Jenjang → .xlsx (jenis/sub jenis jadi kolom agar bisa difilter di Excel). */
export async function buildMatriksWorkbook(data: MatriksData, judul: string, multiRumpun: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Kompetensi & Pelatihan";
  wb.created = new Date();

  const ws = wb.addWorksheet("Matriks", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const kolomJenjang = data.jenjang.length;
  const totalKolom = 4 + kolomJenjang;

  ws.getCell(1, 1).value = `Matriks Pelatihan — ${judul}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getCell(2, 1).value = `${data.summary.total} kompetensi · ${data.summary.tercakup} tercakup · ${data.summary.gap} belum ada pelatihan`;
  ws.getCell(2, 1).font = { italic: true, color: { argb: "FF64748B" } };

  const header = ws.getRow(4);
  ["No", "Jenis", "Sub jenis", "Kompetensi", ...data.jenjang.map((j) => (multiRumpun ? `${j.nama} (${j.rumpun})` : j.nama))].forEach((v, i) => {
    const c = header.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", horizontal: i < 4 ? "left" : "center", wrapText: true };
  });
  header.height = 28;

  data.rows.forEach((row, i) => {
    const r = ws.getRow(5 + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = row.jenis;
    r.getCell(3).value = row.subJenis;
    r.getCell(4).value = row.gap ? `${row.nama}  (BELUM ADA PELATIHAN)` : row.nama;
    row.cells.forEach((cell, ci) => {
      const c = r.getCell(5 + ci);
      c.value = cell.length === 0 ? "—" : teksSel(cell);
      if (cell.length === 0) {
        c.alignment = { horizontal: "center", vertical: "top" };
        c.font = { color: { argb: "FF94A3B8" } };
      }
    });
    for (let k = 1; k <= totalKolom; k++) {
      const c = r.getCell(k);
      c.alignment = { ...c.alignment, vertical: "top", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      if (row.gap && k >= 4) c.fill = GAP_FILL;
    }
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 42;
  for (let k = 5; k <= totalKolom; k++) ws.getColumn(k).width = 40;
  if (data.rows.length > 0) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + data.rows.length, column: totalKolom } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
