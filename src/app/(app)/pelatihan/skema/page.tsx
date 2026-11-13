import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkemaPicker } from "@/components/pelatihan/skema-picker";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { tahunWib } from "@/server/services/pelatihan-refresh";
import { loadSkema, type SkemaView } from "@/server/services/skema";

export const metadata: Metadata = { title: "Skema Pelatihan" };
export const dynamic = "force-dynamic";

export default async function SkemaPage({
  searchParams,
}: {
  searchParams: Promise<{ jf?: string; tahun?: string }>;
}) {
  const user = await requirePageAccess("pelatihan.view");
  const sp = await searchParams;
  let v: SkemaView;
  try {
    v = await loadSkema(scopeFor(user), {
      jf: sp.jf || undefined,
      tahun: /^\d{4}$/.test(sp.tahun ?? "") ? Number(sp.tahun) : undefined,
    });
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const sekarang = tahunWib();
  const tahunOptions = [
    ...new Set([sekarang - 2, sekarang - 1, sekarang, sekarang + 1, v.tahun]),
  ].sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Skema Pelatihan</h1>
          <p className="text-sm text-muted">
            Pelatihan yang tersedia untuk satu jabatan fungsional beserta jenjang, kompetensi, dan
            refreshment-nya.
          </p>
        </div>
        {hasPermission(user, "usulan.create") ? (
          <Link
            href="/pengelolaan/usulan"
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Plus className="size-4" /> Ajukan untuk Pegawai
          </Link>
        ) : null}
      </div>

      {!v.selected ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
          Belum ada jabatan fungsional yang dapat ditampilkan.
        </p>
      ) : (
        <>
          <SkemaPicker
            options={v.options}
            jf={v.selected}
            tahun={v.tahun}
            tahunOptions={tahunOptions}
          />
          <Table>
            <THead>
              <TR>
                <TH>Pelatihan</TH>
                <TH>Program</TH>
                <TH>Jenis / kategori</TH>
                <TH>Jenjang</TH>
                <TH>Kompetensi</TH>
                <TH>Refreshment</TH>
              </TR>
            </THead>
            <tbody>
              {v.rows.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-muted">
                    Belum ada pelatihan untuk jabatan fungsional dan tahun ini.
                  </TD>
                </TR>
              ) : (
                v.rows.map((r) => (
                  <TR key={r.token}>
                    <TD className="font-medium">{r.pelatihan}</TD>
                    <TD>{r.program}</TD>
                    <TD>
                      {r.jenis || <span className="text-muted">—</span>}
                      {r.kategori ? (
                        <span className="block text-xs text-primary">{r.kategori}</span>
                      ) : null}
                    </TD>
                    <TD>
                      {r.jenjang.length ? (
                        r.jenjang.join(", ")
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TD>
                    <TD>
                      {r.kompetensi.length ? (
                        r.kompetensi.join(", ")
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TD>
                    <TD>{r.refreshment}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
