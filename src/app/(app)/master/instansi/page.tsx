import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { MasterCrud } from "@/components/master/master-crud";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { requirePageAccess } from "@/server/auth/guards";
import { JENIS_LABEL, listInstansi } from "@/server/services/master/instansi";
import { pageParams } from "@/server/services/master/shared";
import { createInstansiAction, deleteInstansiAction, updateInstansiAction } from "./actions";

export const metadata: Metadata = { title: "Instansi" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama instansi" },
  { key: "jenis", label: "Jenis", type: "select", options: [{ value: "1", label: "Pusat/Pembina" }, { value: "2", label: "Daerah" }, { value: "3", label: "Pembina lain" }, { value: "4", label: "Lainnya" }] },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function InstansiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("instansi.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listInstansi(scopeFor(user), q, page, f);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari nama instansi…" />
      <FilterBar basePath="/master/instansi" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Instansi"
        fields={[
          { name: "nama", label: "Nama instansi", type: "text", required: true },
          {
            name: "jenis",
            label: "Jenis",
            type: "select",
            required: true,
            options: Object.entries(JENIS_LABEL).map(([value, label]) => ({ value, label })),
          },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "jenisLabel", label: "Jenis" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "instansi.create")}
        canUpdate={hasPermission(user, "instansi.update")}
        canDelete={hasPermission(user, "instansi.delete")}
        onCreate={createInstansiAction}
        onUpdate={updateInstansiAction}
        onDelete={deleteInstansiAction}
      />
      <Pagination basePath="/master/instansi" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
