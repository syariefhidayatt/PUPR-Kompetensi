import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { listRef } from "@/server/services/master/ref-pegawai";
import { pageParams } from "@/server/services/master/shared";
import { createGolonganAction, deleteGolonganAction, updateGolonganAction } from "./actions";

export const metadata: Metadata = { title: "Golongan" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function GolonganPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("golongan.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listRef("golongan", q, page, f);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari golongan…" />
      <FilterBar basePath="/master/golongan" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Golongan"
        fields={[
          { name: "nama", label: "Nama", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "golongan.create")}
        canUpdate={hasPermission(user, "golongan.update")}
        canDelete={hasPermission(user, "golongan.delete")}
        onCreate={createGolonganAction}
        onUpdate={updateGolonganAction}
        onDelete={deleteGolonganAction}
      />
      <Pagination basePath="/master/golongan" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
