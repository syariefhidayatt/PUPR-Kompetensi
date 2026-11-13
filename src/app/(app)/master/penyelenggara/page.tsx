import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { listPenyelenggara } from "@/server/services/master/penyelenggara";
import { pageParams } from "@/server/services/master/shared";
import { createPenyelenggaraAction, deletePenyelenggaraAction, updatePenyelenggaraAction } from "./actions";

export const metadata: Metadata = { title: "Penyelenggara" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama penyelenggara" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function PenyelenggaraPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("penyelenggara.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listPenyelenggara(q, page, f);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari penyelenggara…" />
      <FilterBar basePath="/master/penyelenggara" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Penyelenggara"
        fields={[
          { name: "nama", label: "Nama penyelenggara", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "penyelenggara.create")}
        canUpdate={hasPermission(user, "penyelenggara.update")}
        canDelete={hasPermission(user, "penyelenggara.delete")}
        onCreate={createPenyelenggaraAction}
        onUpdate={updatePenyelenggaraAction}
        onDelete={deletePenyelenggaraAction}
      />
      <Pagination basePath="/master/penyelenggara" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
