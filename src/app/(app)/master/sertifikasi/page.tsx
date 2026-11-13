import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { MasterCrud } from "@/components/master/master-crud";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { pageParams } from "@/server/services/master/shared";
import { listSertifikasi } from "@/server/services/master/sertifikasi";
import { createSertifikasiAction, deleteSertifikasiAction, updateSertifikasiAction } from "./actions";

export const metadata: Metadata = { title: "Sertifikasi" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama sertifikasi" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function SertifikasiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("sertifikasi.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listSertifikasi(q, page, f);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari sertifikasi…" />
      <FilterBar basePath="/master/sertifikasi" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Sertifikasi"
        fields={[
          { name: "nama", label: "Nama sertifikasi", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "sertifikasi.create")}
        canUpdate={hasPermission(user, "sertifikasi.update")}
        canDelete={hasPermission(user, "sertifikasi.delete")}
        onCreate={createSertifikasiAction}
        onUpdate={updateSertifikasiAction}
        onDelete={deleteSertifikasiAction}
      />
      <Pagination basePath="/master/sertifikasi" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
