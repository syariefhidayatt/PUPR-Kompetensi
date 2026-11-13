import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { MasterCrud } from "@/components/master/master-crud";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { requirePageAccess } from "@/server/auth/guards";
import { instansiOptions } from "@/server/services/master/instansi";
import { listJf } from "@/server/services/master/jf";
import { pageParams } from "@/server/services/master/shared";
import { createJfAction, deleteJfAction, updateJfAction } from "./actions";

export const metadata: Metadata = { title: "Jabatan Fungsional" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "kode", label: "Kode" },
  { key: "nama", label: "Nama JF" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function JfPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("jf.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, instansi] = await Promise.all([listJf(scope, q, page, f), instansiOptions(scope)]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari JF, kode, atau instansi…" />
      <FilterBar basePath="/master/jf" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Jabatan Fungsional"
        fields={[
          { name: "instansi", label: "Instansi", type: "select", required: true, options: instansi },
          { name: "kodeJf", label: "Kode", type: "text", placeholder: "mis. PJK" },
          { name: "namaJf", label: "Nama jabatan fungsional", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "instansiNama", label: "Instansi" },
          { key: "kodeJf", label: "Kode" },
          { key: "namaJf", label: "Nama JF" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "jf.create")}
        canUpdate={hasPermission(user, "jf.update")}
        canDelete={hasPermission(user, "jf.delete")}
        onCreate={createJfAction}
        onUpdate={updateJfAction}
        onDelete={deleteJfAction}
      />
      <Pagination basePath="/master/jf" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
