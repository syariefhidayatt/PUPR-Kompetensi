import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { ExportButtons } from "@/components/pengelolaan/export-buttons";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { BATCH_STATUS, BATCH_STATUS_LABEL, KEHADIRAN, KEHADIRAN_LABEL } from "@/lib/schemas/batch";
import { requirePageAccess } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { pageParams } from "@/server/services/master/shared";
import { listRekap, rekapPerBatch } from "@/server/services/pengelolaan";

export const metadata: Metadata = { title: "Rekap Peserta" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "pegawai", label: "Nama / NIP pegawai" },
  { key: "pelatihan", label: "Pelatihan" },
  { key: "instansi", label: "Instansi" },
  { key: "tahun", label: "Tahun", type: "number" },
  { key: "kehadiran", label: "Kehadiran", type: "select", options: KEHADIRAN.map((k) => ({ value: k, label: KEHADIRAN_LABEL[k] })) },
  { key: "lulus", label: "Kelulusan", type: "select", options: [{ value: "lulus", label: "Lulus" }, { value: "tidak_lulus", label: "Tidak lulus" }, { value: "belum", label: "Belum dinilai" }] },
  { key: "status_batch", label: "Status batch", type: "select", options: BATCH_STATUS.map((s) => ({ value: s, label: BATCH_STATUS_LABEL[s] })) },
];

const num = "px-4 py-3 text-right tabular-nums";
const KEH_BADGE: Record<string, string> = {
  hadir: "bg-green-500/15 text-green-500",
  selesai: "bg-blue-500/15 text-blue-400",
  tidak_hadir: "bg-red-500/15 text-red-500",
  terdaftar: "bg-amber-500/15 text-amber-500",
};

export default async function RekapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("rekap.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const tampil = sp.tampil === "batch" ? "batch" : "peserta";
  const tp = tampil === "batch" ? { tampil } : {};
  const exportParams = { ...fp, ...tp, q };

  const tab = (t: string, label: string) => (
    <Link
      href={`/pengelolaan/rekap?${new URLSearchParams({ ...(q ? { q } : {}), ...fp, ...(t === "batch" ? { tampil: "batch" } : {}) })}`}
      aria-current={tampil === t ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm ${tampil === t ? "bg-primary text-primary-foreground" : "border border-border hover:bg-background"}`}
    >
      {label}
    </Link>
  );

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Rekap Peserta</h1>
        <p className="text-sm text-muted">Rekap peserta pelatihan per orang atau per batch. Filter dan pencarian ikut terbawa saat diunduh.</p>
      </div>
      <ExportButtons href="/pengelolaan/rekap/export" params={exportParams} />
    </div>
  );

  if (tampil === "batch") {
    const rows = await rekapPerBatch(scope, q, f);
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        {header}
        <SearchBar q={q} extra={{ ...fp, tampil }} placeholder="Cari nama atau NIP…" />
        <FilterBar basePath="/pengelolaan/rekap" defs={FILTERS} values={f} q={q} />
        <div className="flex gap-2 print:hidden">{tab("peserta", "Per peserta")}{tab("batch", "Per batch")}</div>
        <Table>
          <THead>
            <TR>
              <TH>Batch</TH><TH>Status</TH>
              <TH className="text-right">Peserta</TH><TH className="text-right">Terdaftar</TH><TH className="text-right">Hadir</TH>
              <TH className="text-right">Selesai</TH><TH className="text-right">Tidak hadir</TH><TH className="text-right">Lulus</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR><TD colSpan={8} className="py-8 text-center text-muted">Tidak ada data.</TD></TR>
            ) : (
              rows.map((r) => (
                <TR key={`${r.pelatihan}-${r.tahun}-${r.angkatan}`}>
                  <TD>{r.pelatihan}<span className="block text-xs text-muted">{r.tahun} · Angkatan {r.angkatan} · {r.mulai}</span></TD>
                  <TD>{r.status}</TD>
                  <TD className={`${num} font-semibold`}>{r.total}</TD>
                  <TD className={num}>{r.terdaftar}</TD>
                  <TD className={num}>{r.hadir}</TD>
                  <TD className={num}>{r.selesai}</TD>
                  <TD className={num}>{r.tidakHadir}</TD>
                  <TD className={num}>{r.lulus}</TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </div>
    );
  }

  const { rows, total, ringkas } = await listRekap(scope, q, page, f);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {header}
      <SearchBar q={q} extra={fp} placeholder="Cari nama atau NIP…" />
      <FilterBar basePath="/pengelolaan/rekap" defs={FILTERS} values={f} q={q} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 print:hidden">{tab("peserta", "Per peserta")}{tab("batch", "Per batch")}</div>
        <p className="text-sm" aria-live="polite">
          <strong>{total}</strong> peserta · {KEHADIRAN.map((k) => `${KEHADIRAN_LABEL[k]} ${ringkas[k]}`).join(" · ")}
        </p>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Pegawai</TH><TH>Unit organisasi / kerja</TH><TH>Pelatihan</TH><TH>Jadwal batch</TH>
            <TH>Kehadiran</TH><TH>Nilai / lulus</TH><TH>No. sertifikat</TH><TH>Aksi</TH>
          </TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR><TD colSpan={8} className="py-8 text-center text-muted">Tidak ada data.</TD></TR>
          ) : (
            rows.map((r) => (
              <TR key={r.token}>
                <TD>
                  <span className="font-semibold">{r.nama}</span>
                  <span className="block text-xs text-muted">{r.nip}</span>
                  {r.jabatan ? <span className="block text-xs text-muted">{r.jabatan}</span> : null}
                </TD>
                <TD>
                  {r.unitOrganisasi || <span className="text-muted">—</span>}
                  {r.unitKerja ? <span className="block text-xs text-muted">{r.unitKerja}</span> : null}
                </TD>
                <TD>
                  <span className="font-semibold">{r.pelatihan}</span>
                  <span className="block text-xs text-muted">{r.program}</span>
                </TD>
                <TD>
                  {r.tahun} - Angkatan {r.angkatan}
                  <span className="block text-xs text-muted">{r.mulai} s/d {r.selesai}</span>
                  {r.penyelenggara ? <span className="block text-xs text-muted">{r.penyelenggara}</span> : null}
                </TD>
                <TD>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${KEH_BADGE[r.kehadiranKode] ?? "bg-muted/20 text-muted"}`}>
                    • {r.kehadiran}
                  </span>
                </TD>
                <TD>
                  {r.nilai || <span className="text-muted">—</span>}
                  {r.lulus ? (
                    <span className={`mt-1 block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${r.lulusKode === "lulus" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                      • {r.lulus}
                    </span>
                  ) : null}
                </TD>
                <TD>{r.noSertifikat || <span className="text-muted">—</span>}</TD>
                <TD>
                  {r.lulusKode === "lulus" && r.noSertifikat ? (
                    <Link href={`/pengelolaan/rekap/sertifikat/${r.token}`} className="inline-block rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background">
                      Cetak Sertifikat
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
              </TR>
            ))
          )}
        </tbody>
      </Table>
      <Pagination basePath="/pengelolaan/rekap" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
