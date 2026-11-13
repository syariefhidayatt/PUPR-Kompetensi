import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { instansiOptions } from "@/server/services/master/instansi";
import { pageParams } from "@/server/services/master/shared";
import { listUnitKerja, unitOrganisasiOptions } from "@/server/services/master/unit";
import { createUnitKerjaAction, deleteUnitKerjaAction, updateUnitKerjaAction } from "./actions";

export const metadata: Metadata = { title: "Unit Kerja" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "uo", label: "Unit organisasi" },
  { key: "kode", label: "Kode" },
  { key: "nama", label: "Nama" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function UnitKerjaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("unit_kerja.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, instansi, uo] = await Promise.all([listUnitKerja(scope, q, page, f), instansiOptions(scope), unitOrganisasiOptions(scope)]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari unit kerja, kode, unit organisasi, atau instansi…" />
      <FilterBar basePath="/master/unit-kerja" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Unit Kerja"
        fields={[
          { name: "instansi", label: "Instansi", type: "select", required: true, options: instansi },
          { name: "unitOrganisasi", label: "Unit organisasi (satu instansi dengan unit kerja)", type: "select", optional: true, options: uo },
          { name: "kode", label: "Kode", type: "text", required: true },
          { name: "nama", label: "Nama unit kerja", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "instansiNama", label: "Instansi" },
          { key: "unitOrganisasiNama", label: "Unit organisasi" },
          { key: "kode", label: "Kode" },
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "unit_kerja.create")}
        canUpdate={hasPermission(user, "unit_kerja.update")}
        canDelete={hasPermission(user, "unit_kerja.delete")}
        onCreate={createUnitKerjaAction}
        onUpdate={updateUnitKerjaAction}
        onDelete={deleteUnitKerjaAction}
      />
      <Pagination basePath="/master/unit-kerja" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
