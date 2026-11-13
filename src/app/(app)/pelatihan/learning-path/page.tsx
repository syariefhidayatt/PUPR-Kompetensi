import { Award } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/server/auth/guards";
import { ids } from "@/server/ids";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import {
  cariPegawai,
  loadLearningPath,
  type LearningPathView,
} from "@/server/services/learning-path";
import type { LpStatus } from "@/server/services/learning-path-calc";

export const metadata: Metadata = { title: "Learning Path" };
export const dynamic = "force-dynamic";

const STATUS: Record<LpStatus, { label: string; cls: string }> = {
  selesai: { label: "Selesai", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
  perlu_refresh: {
    label: "Perlu refresh",
    cls: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  },
  wajib_sekarang: {
    label: "Wajib sekarang",
    cls: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  terlewat: { label: "Terlewat", cls: "bg-red-500/20 text-red-600 dark:text-red-400" },
  akan_datang: { label: "Akan datang", cls: "border border-border text-muted" },
  tidak_berlaku: { label: "—", cls: "text-muted opacity-50" },
};
const USULAN_LABEL: Record<string, string> = {
  mengusulkan: "Diusulkan",
  diajukan: "Diajukan",
  disetujui: "Disetujui",
};
const BISA_DIUSULKAN: LpStatus[] = ["wajib_sekarang", "terlewat", "perlu_refresh"];

export default async function LearningPathPage({
  searchParams,
}: {
  searchParams: Promise<{ pegawai?: string; tahun?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const canPick = hasPermission(user, "pelatihan.view");
  const canUsul = hasPermission(user, "usulan.create");
  const ctx = { idUser: BigInt(user.id), scope: scopeFor(user), canPick };
  const tahunNum = sp.tahun ? Number(sp.tahun) : undefined;

  let view: LearningPathView;
  try {
    view = await loadLearningPath(ctx, {
      pegawai: sp.pegawai || undefined,
      tahun: Number.isInteger(tahunNum) ? tahunNum : undefined,
    });
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const hasil = canPick && sp.q ? await cariPegawai(ctx, sp.q.slice(0, 100)) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Learning Path</h1>
        {view.state === "ok" ? <PrintButton /> : null}
      </div>

      {canPick ? (
        <div className="space-y-2 rounded-lg print:hidden border border-border bg-card p-4">
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              maxLength={100}
              placeholder="Cari pegawai (nama atau NIP)…"
              className="w-72 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
            >
              Cari
            </button>
          </form>
          {sp.q ? (
            hasil.length === 0 ? (
              <p className="text-sm text-muted">Tidak ada pegawai yang cocok.</p>
            ) : (
              <ul className="text-sm">
                {hasil.map((h) => (
                  <li key={h.token}>
                    <Link
                      href={`/pelatihan/learning-path?pegawai=${encodeURIComponent(h.token)}`}
                      className="text-primary hover:underline"
                    >
                      {h.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      {view.state === "tidak_ada_pegawai" ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
          {canPick
            ? "Cari pegawai di atas untuk melihat learning path-nya."
            : "Akun Anda belum terhubung ke data pegawai. Hubungi admin."}
        </p>
      ) : view.state === "belum_penempatan" ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="font-medium">
            {view.pegawai.nama} ({view.pegawai.nip})
          </p>
          <p className="mt-1 text-muted">
            Belum ada penempatan aktif dengan jabatan fungsional dan jenjang, sehingga learning path
            belum dapat dihitung.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
            <div>
              <p className="font-medium">
                {view.pegawai.nama} <span className="text-muted">({view.pegawai.nip})</span>
              </p>
              <p className="text-muted">
                {view.pegawai.jf} · jenjang sekarang: {view.jenjangSekarang} · tahun acuan{" "}
                {view.tahun}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs" aria-label="Ringkasan status">
              {(["selesai", "perlu_refresh", "wajib_sekarang", "terlewat"] as const).map((s) => (
                <li key={s} className={`rounded px-2 py-1 ${STATUS[s].cls}`}>
                  {STATUS[s].label}: {view.summary[s]}
                </li>
              ))}
            </ul>
          </div>

          {view.rows.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted">
              JF ini belum memiliki pelatihan aktif.
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible rounded-lg border border-border bg-card">
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 min-w-64 border-b border-r border-border bg-card px-3 py-3 text-xs uppercase tracking-wide text-muted">
                      Pelatihan
                    </th>
                    {view.kolom.map((k) => (
                      <th
                        key={k.id}
                        className="sticky top-0 z-20 min-w-32 border-b border-border bg-card px-3 py-3 text-center text-xs uppercase tracking-wide text-muted"
                      >
                        {k.nama}
                        {k.sekarang ? (
                          <span className="block normal-case tracking-normal text-primary">
                            jenjang sekarang
                          </span>
                        ) : null}
                      </th>
                    ))}
                    <th className="sticky top-0 z-20 min-w-28 border-b border-border bg-card px-3 py-3 text-center text-xs uppercase tracking-wide text-muted">
                      Usulan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-3 align-top">
                        {r.nama}
                        {r.kategori ? (
                          <span className="ml-1.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                            {r.kategori}
                          </span>
                        ) : null}
                        {r.sertifikat ? (
                          <Award
                            className="ml-1 inline size-3.5 text-amber-500"
                            aria-label="Bersertifikat"
                          />
                        ) : null}
                      </td>
                      {r.cells.map((c, i) => (
                        <td
                          key={view.kolom[i]?.id ?? i}
                          className="border-b border-border px-2 py-3 text-center"
                        >
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS[c].cls}`}
                          >
                            {STATUS[c].label}
                          </span>
                        </td>
                      ))}
                      <td className="border-b border-border px-2 py-3 text-center text-xs">
                        {r.usulan ? (
                          <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">
                            {USULAN_LABEL[r.usulan] ?? r.usulan}
                          </span>
                        ) : canUsul && r.cells.some((c) => BISA_DIUSULKAN.includes(c)) ? (
                          <Link
                            href={`/pengelolaan/usulan?${new URLSearchParams({ ...(sp.pegawai ? { pegawai: sp.pegawai } : {}), pelatihan: ids().encode("pelatihan", BigInt(r.id)) })}`}
                            className="rounded border border-border px-2 py-0.5 text-primary hover:bg-background"
                          >
                            Usulkan
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
