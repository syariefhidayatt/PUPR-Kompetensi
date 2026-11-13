import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { instansiOptions } from "@/server/services/master/instansi";
import { pageParams } from "@/server/services/master/shared";
import { listUnitOrganisasi } from "@/server/services/master/unit";
import { createUnitOrganisasiAction, deleteUnitOrganisasiAction, updateUnitOrganisasiAction } from "./actions";

export const metadata: Metadata = { title: "Unit Organisasi" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "kode", label: "Kode" },
  { key: "nama", label: "Nama" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function UnitOrganisasiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("unit_organisasi.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, instansi] = await Promise.all([listUnitOrganisasi(scope, q, page, f), instansiOptions(scope)]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari unit, kode, atau instansi…" />
      <FilterBar basePath="/master/unit-organisasi" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Unit Organisasi"
        fields={[
          { name: "instansi", label: "Instansi", type: "select", required: true, options: instansi },
          { name: "kode", label: "Kode", type: "text", required: true },
          { name: "nama", label: "Nama unit organisasi", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "instansiNama", label: "Instansi" },
          { key: "kode", label: "Kode" },
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "unit_organisasi.create")}
        canUpdate={hasPermission(user, "unit_organisasi.update")}
        canDelete={hasPermission(user, "unit_organisasi.delete")}
        onCreate={createUnitOrganisasiAction}
        onUpdate={updateUnitOrganisasiAction}
        onDelete={deleteUnitOrganisasiAction}
      />
      <Pagination basePath="/master/unit-organisasi" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
