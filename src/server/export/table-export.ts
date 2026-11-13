import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Tabel generik untuk ekspor Excel & PDF (dipakai semua halaman Pengelolaan). */
export type TableData = {
  title: string;
  subtitle?: string;
  /** Pasangan label–nilai di atas tabel, mis. ["Total peserta", "120"]. */
  summary?: [string, string][];
  columns: { header: string; align?: "left" | "center" | "right"; width?: number }[];
  rows: (string | number | null)[][];
};

export type ExportFormat = "xlsx" | "pdf";
export const isFormat = (v: string | null | undefined): v is ExportFormat => v === "xlsx" || v === "pdf";

const cell = (v: string | number | null) => (v === null || v === undefined ? "" : v);

export async function tableToXlsx(t: TableData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Kompetensi & Pelatihan";
  wb.created = new Date();
  const ws = wb.addWorksheet(t.title.slice(0, 31).replace(/[\\/*?:[\]]/g, " "), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  let r = 1;
  ws.getCell(r, 1).value = t.title;
  ws.getCell(r++, 1).font = { bold: true, size: 14 };
  if (t.subtitle) {
    ws.getCell(r, 1).value = t.subtitle;
    ws.getCell(r++, 1).font = { italic: true, color: { argb: "FF64748B" } };
  }
  for (const [k, v] of t.summary ?? []) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r++, 2).value = v;
  }
  r++;
  const headerRow = r;
  t.columns.forEach((c, i) => {
    const x = ws.getRow(r).getCell(i + 1);
    x.value = c.header;
    x.font = { bold: true, color: { argb: "FFFFFFFF" } };
    x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2744" } };
    x.alignment = { vertical: "middle", horizontal: c.align ?? "left", wrapText: true };
  });
  ws.getRow(r).height = 24;
  r++;
  for (const row of t.rows) {
    const x = ws.getRow(r++);
    row.forEach((v, i) => {
      const c = x.getCell(i + 1);
      c.value = cell(v); // string biasa → bukan rumus, aman dari injeksi "=…"
      c.alignment = { vertical: "top", horizontal: t.columns[i]?.align ?? "left", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
  }
  t.columns.forEach((c, i) => {
    const maks = Math.max(c.header.length, ...t.rows.slice(0, 200).map((row) => String(row[i] ?? "").split("\n").reduce((m, s) => Math.max(m, s.length), 0)));
    ws.getColumn(i + 1).width = c.width ?? Math.min(Math.max(maks + 2, 8), 50);
  });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  if (t.rows.length > 0) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + t.rows.length, column: t.columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Font bawaan PDF (Helvetica) hanya Latin-1: ganti karakter di luar itu agar tidak rusak. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[★•]/g, "*")
    .replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?");
}

export function tableToPdf(t: TableData, footerNote: string): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 10;
  let y = 14;
  doc.setFont("helvetica", "bold").setFontSize(14).text(pdfSafe(t.title), margin, y);
  y += 6;
  if (t.subtitle) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(100).text(pdfSafe(t.subtitle), margin, y);
    y += 5;
  }
  doc.setTextColor(0).setFont("helvetica", "normal").setFontSize(9);
  for (const [k, v] of t.summary ?? []) {
    doc.text(pdfSafe(`${k}: ${v}`), margin, y);
    y += 4.5;
  }
  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [t.columns.map((c) => pdfSafe(c.header))],
    body: t.rows.map((row) => row.map((v) => pdfSafe(String(cell(v))))),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [15, 39, 68], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: Object.fromEntries(t.columns.map((c, i) => [i, { halign: c.align ?? "left", ...(c.width ? { cellWidth: c.width } : {}) }])),
    showHead: "everyPage",
  });
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120);
    doc.text(pdfSafe(footerNote), margin, h - 5);
    doc.text(`Halaman ${i} dari ${total}`, w - margin, h - 5, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

const slug = (s: string) => s.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "data";

/** Waktu WIB untuk catatan kaki dokumen. */
export function waktuWib(d = new Date()): string {
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB";
}

export async function exportResponse(format: ExportFormat, t: TableData, base: string, pencetak: string): Promise<Response> {
  const name = `${slug(base)}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const body =
    format === "xlsx" ? await tableToXlsx(t) : tableToPdf(t, `Dicetak ${waktuWib()} oleh ${pencetak} - Sistem Kompetensi & Pelatihan`);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
