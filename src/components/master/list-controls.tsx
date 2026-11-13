import Link from "next/link";
import { PAGE_SIZE } from "@/server/services/master/shared";

/** Pencarian via GET biasa (tanpa JS): hasilnya difilter di SQL oleh service. */
export function SearchBar({ q, placeholder, extra }: { q?: string; placeholder?: string; extra?: Record<string, string> | undefined }) {
  return (
    <form method="get" className="flex gap-2">
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder ?? "Cari…"}
        maxLength={100}
        className="w-64 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
      />
      <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background">
        Cari
      </button>
    </form>
  );
}

export function Pagination({
  basePath,
  page,
  total,
  q,
  extra,
}: {
  basePath: string;
  page: number;
  total: number;
  q?: string;
  extra?: Record<string, string> | undefined;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background";

  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <span>{total} data</span>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={link}>
              ← Sebelumnya
            </Link>
          ) : null}
          <span>
            Hal. {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className={link}>
              Berikutnya →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
