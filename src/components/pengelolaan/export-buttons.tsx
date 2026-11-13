import { FileDown, FileSpreadsheet } from "lucide-react";

/** Tautan unduh Excel/PDF. Parameter filter ikut dibawa agar berkas sama dengan yang tampil di layar. */
export function ExportButtons({ href, params = {} }: { href: string; params?: Record<string, string | undefined> }) {
  const url = (format: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("format", format);
    return `${href}?${sp.toString()}`;
  };
  const cls = "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background";
  return (
    <div className="flex items-center gap-2 print:hidden">
      <a href={url("xlsx")} className={cls}>
        <FileSpreadsheet className="size-4" /> Excel
      </a>
      <a href={url("pdf")} className={cls}>
        <FileDown className="size-4" /> PDF
      </a>
    </div>
  );
}
