import Link from "next/link";
import { Filter } from "lucide-react";
import type { FilterDef, Filters } from "@/lib/filters";

const field = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary";

/** Panel filter per kolom (GET biasa). Terbuka otomatis bila ada filter aktif. */
export function FilterBar({ basePath, defs, values, q }: { basePath: string; defs: FilterDef[]; values: Filters; q?: string | undefined }) {
  const aktif = defs.filter((d) => values[d.key]).length;
  return (
    <details open={aktif > 0} className="rounded-lg border border-border bg-card print:hidden">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium">
        <Filter className="size-4" /> Filter kolom
        {aktif > 0 ? <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">{aktif} aktif</span> : null}
      </summary>
      <form method="get" action={basePath} className="space-y-3 border-t border-border p-4">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {defs.map((d) => (
            <label key={d.key} className="space-y-1 text-xs text-muted">
              <span>{d.label}</span>
              {d.type === "select" ? (
                <select name={`f_${d.key}`} defaultValue={values[d.key] ?? ""} className={field}>
                  <option value="">Semua</option>
                  {d.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={`f_${d.key}`}
                  type={d.type === "number" ? "number" : "text"}
                  defaultValue={values[d.key] ?? ""}
                  maxLength={100}
                  placeholder={d.placeholder ?? "Berisi…"}
                  className={field}
                />
              )}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Terapkan
          </button>
          <Link href={q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background">
            Reset filter
          </Link>
        </div>
      </form>
    </details>
  );
}
