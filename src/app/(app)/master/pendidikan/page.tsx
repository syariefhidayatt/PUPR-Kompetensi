import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { listRef } from "@/server/services/master/ref-pegawai";
import { pageParams } from "@/server/services/master/shared";
import { createPendidikanAction, deletePendidikanAction, updatePendidikanAction } from "./actions";

export const metadata: Metadata = { title: "Pendidikan" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function PendidikanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("pendidikan.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listRef("pendidikan", q, page, f);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari pendidikan…" />
      <FilterBar basePath="/master/pendidikan" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Pendidikan"
        fields={[
          { name: "nama", label: "Nama", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "pendidikan.create")}
        canUpdate={hasPermission(user, "pendidikan.update")}
        canDelete={hasPermission(user, "pendidikan.delete")}
        onCreate={createPendidikanAction}
        onUpdate={updatePendidikanAction}
        onDelete={deletePendidikanAction}
      />
      <Pagination basePath="/master/pendidikan" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
