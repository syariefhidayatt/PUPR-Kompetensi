import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { filterParams, readFilters, YA_TIDAK_OPTIONS, type FilterDef } from "@/lib/filters";
import { BATCH_STATUS_LABEL } from "@/lib/schemas/batch";
import { requirePageAccess } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { pageParams } from "@/server/services/master/shared";
import { listBatchVerifikasi } from "@/server/services/pengelolaan";

export const metadata: Metadata = { title: "Verifikasi Kehadiran" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "pelatihan", label: "Pelatihan" },
  { key: "tahun", label: "Tahun", type: "number" },
  { key: "status", label: "Status batch", type: "select", options: ["terjadwal", "berjalan", "selesai"].map((s) => ({ value: s, label: BATCH_STATUS_LABEL[s as keyof typeof BATCH_STATUS_LABEL] })) },
  { key: "perlu", label: "Ada yang belum diverifikasi", type: "select", options: YA_TIDAK_OPTIONS.slice(0, 1) },
];

export default async function KehadiranPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("kehadiran.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listBatchVerifikasi(scopeFor(user), q, page, f);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Verifikasi Kehadiran</h1>
        <p className="text-sm text-muted">Pilih batch untuk memverifikasi kehadiran pesertanya. Hanya batch terjadwal, berjalan, atau selesai yang tampil.</p>
      </div>
      <SearchBar q={q} extra={fp} placeholder="Cari pelatihan…" />
      <FilterBar basePath="/pengelolaan/kehadiran" defs={FILTERS} values={f} q={q} />
      <Table>
        <THead>
          <TR><TH>Batch</TH><TH>Jadwal</TH><TH>Status</TH><TH className="text-right">Peserta</TH><TH className="text-right">Belum diverifikasi</TH><TH><span className="sr-only">Aksi</span></TH></TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR><TD colSpan={6} className="py-8 text-center text-muted">Tidak ada batch.</TD></TR>
          ) : (
            rows.map((b) => (
              <TR key={b.token}>
                <TD className="font-medium">{b.pelatihan}<span className="block text-xs font-normal text-muted">{b.tahun} · Angkatan {b.angkatan}</span></TD>
                <TD>{b.mulai} s/d {b.selesai}</TD>
                <TD>{BATCH_STATUS_LABEL[b.status as keyof typeof BATCH_STATUS_LABEL] ?? b.status}</TD>
                <TD className="text-right tabular-nums">{b.peserta}</TD>
                <TD className="text-right tabular-nums">{b.belumDiverifikasi > 0 ? <strong className="text-amber-600">{b.belumDiverifikasi}</strong> : 0}</TD>
                <TD className="text-right"><Link href={`/pengelolaan/kehadiran/${b.token}`} className="text-primary hover:underline">Verifikasi</Link></TD>
              </TR>
            ))
          )}
        </tbody>
      </Table>
      <Pagination basePath="/pengelolaan/kehadiran" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
