import { Award } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JfPicker } from "@/components/matriks/jf-picker";
import { PrintButton } from "@/components/print-button";
import { requirePageAccess } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { loadMatriks, type MatriksView } from "@/server/services/matriks";

export const metadata: Metadata = { title: "Matriks Pelatihan" };
export const dynamic = "force-dynamic";

export default async function MatriksPage({ searchParams }: { searchParams: Promise<{ jf?: string }> }) {
  const user = await requirePageAccess("pelatihan.view");
  const { jf } = await searchParams;

  let view: MatriksView;
  try {
    view = await loadMatriks(scopeFor(user), jf || undefined);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const { options, selected, data, multiRumpun } = view;

  if (!selected || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Matriks Pelatihan</h1>
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
          Belum ada jabatan fungsional yang dapat ditampilkan.
        </p>
      </div>
    );
  }

  const colSpan = 2 + data.jenjang.length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Matriks Pelatihan</h1>
      <p className="hidden text-sm print:block">{options.find((o) => o.value === selected)?.label}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="print:hidden"><JfPicker options={options} value={selected} /></div>
        <div className="flex items-center gap-2 print:hidden">
          <a href={`/pelatihan/matriks/export?jf=${encodeURIComponent(selected)}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background">
            Unduh Excel
          </a>
          <PrintButton />
        </div>
        <p className="text-sm" aria-live="polite">
          <strong>{data.summary.total}</strong> kompetensi · <strong>{data.summary.tercakup}</strong> tercakup ·{" "}
          <strong className={data.summary.gap > 0 ? "text-red-500" : undefined}>{data.summary.gap}</strong> gap
        </p>
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
          JF ini belum memiliki kompetensi aktif.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible rounded-lg border border-border bg-card">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-12 border-b border-border bg-card px-3 py-3 text-xs uppercase tracking-wide text-muted">
                  No
                </th>
                <th className="sticky left-12 top-0 z-30 min-w-56 border-b border-r border-border bg-card px-3 py-3 text-xs uppercase tracking-wide text-muted">
                  Kompetensi
                </th>
                {data.jenjang.map((j) => (
                  <th key={j.id} className="sticky top-0 z-20 min-w-52 border-b border-border bg-card px-3 py-3 text-xs uppercase tracking-wide text-muted">
                    {j.nama}
                    {multiRumpun ? <span className="block normal-case tracking-normal opacity-70">{j.rumpun}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                const prev = data.rows[i - 1];
                const newGroup = !prev || prev.jenis !== row.jenis || prev.subJenis !== row.subJenis;
                return [
                  newGroup ? (
                    <tr key={`g-${row.id}`}>
                      <td colSpan={colSpan} className="border-b border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted">
                        {row.jenis} › {row.subJenis}
                      </td>
                    </tr>
                  ) : null,
                  <tr key={row.id}>
                    <td className="sticky left-0 z-10 border-b border-border bg-card px-3 py-3 align-top text-muted">{i + 1}</td>
                    <td className="sticky left-12 z-10 border-b border-r border-border bg-card px-3 py-3 align-top font-medium">
                      {row.nama}
                      {row.gap ? (
                        <span className="mt-1 block w-fit rounded bg-red-500/15 px-2 py-0.5 text-xs font-normal text-red-500">
                          Belum ada pelatihan
                        </span>
                      ) : null}
                    </td>
                    {row.cells.map((cell, ci) => (
                      <td
                        key={data.jenjang[ci]?.id ?? ci}
                        className={`border-b border-border px-3 py-3 align-top ${cell.length === 0 ? "matrix-cell-empty" : ""}`}
                      >
                        {cell.length === 0 ? (
                          <span className="text-muted" aria-label="Belum ada pelatihan">
                            —
                          </span>
                        ) : (
                          <ol className="list-inside list-decimal space-y-1">
                            {cell.map((p) => (
                              <li key={p.id}>
                                {p.nama}
                                {p.kategori ? (
                                  <span className="ml-1.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">{p.kategori}</span>
                                ) : null}
                                {p.sertifikat ? <Award className="ml-1 inline size-3.5 text-amber-500" aria-label="Bersertifikat" /> : null}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
