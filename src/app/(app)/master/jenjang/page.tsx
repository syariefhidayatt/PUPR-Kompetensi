import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { MasterCrud } from "@/components/master/master-crud";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { RUMPUN_LABEL } from "@/lib/schemas/master";
import { listJenjang } from "@/server/services/master/jenjang";
import { pageParams } from "@/server/services/master/shared";
import { createJenjangAction, deleteJenjangAction, updateJenjangAction } from "./actions";

export const metadata: Metadata = { title: "Jenjang Jabatan" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Nama jenjang" },
  { key: "rumpun", label: "Rumpun", type: "select", options: [{ value: "KEAHLIAN", label: "Keahlian" }, { value: "KETERAMPILAN", label: "Keterampilan" }] },
  { key: "urutan", label: "Urutan", type: "number" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function JenjangPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("jenjang.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listJenjang(q, page, f);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari jenjang…" />
      <FilterBar basePath="/master/jenjang" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Jenjang Jabatan"
        fields={[
          {
            name: "rumpun",
            label: "Rumpun",
            type: "select",
            required: true,
            options: Object.entries(RUMPUN_LABEL).map(([value, label]) => ({ value, label })),
          },
          { name: "nama", label: "Nama jenjang", type: "text", required: true },
          { name: "urutan", label: "Urutan dalam rumpun (1 = terendah)", type: "number", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "rumpunLabel", label: "Rumpun" },
          { key: "urutan", label: "Urutan" },
          { key: "nama", label: "Nama" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "jenjang.create")}
        canUpdate={hasPermission(user, "jenjang.update")}
        canDelete={hasPermission(user, "jenjang.delete")}
        onCreate={createJenjangAction}
        onUpdate={updateJenjangAction}
        onDelete={deleteJenjangAction}
      />
      <Pagination basePath="/master/jenjang" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
