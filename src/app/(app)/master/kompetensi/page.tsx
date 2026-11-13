import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { jenisDetailOptions } from "@/server/services/master/jenis-kompetensi";
import { jfOptions } from "@/server/services/master/jf";
import { listKompetensi } from "@/server/services/master/kompetensi";
import { pageParams } from "@/server/services/master/shared";
import { createKompetensiAction, deleteKompetensiAction, updateKompetensiAction } from "./actions";

export const metadata: Metadata = { title: "Kompetensi" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "jf", label: "Jabatan fungsional" },
  { key: "jenis", label: "Jenis" },
  { key: "sub", label: "Sub jenis" },
  { key: "nama", label: "Kompetensi" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function KompetensiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("kompetensi.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, jf, detail] = await Promise.all([
    listKompetensi(scope, q, page, f),
    jfOptions(scope),
    jenisDetailOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari kompetensi, JF, instansi, atau sub jenis…" />
      <FilterBar basePath="/master/kompetensi" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Kompetensi"
        fields={[
          { name: "jf", label: "Jabatan fungsional", type: "select", required: true, options: jf },
          { name: "jenisDetail", label: "Jenis › sub jenis", type: "select", required: true, options: detail },
          { name: "namaKompetensi", label: "Nama kompetensi", type: "text", required: true },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "instansiNama", label: "Instansi" },
          { key: "jfSaja", label: "JF" },
          { key: "jenisLabel", label: "Jenis" },
          { key: "namaKompetensi", label: "Kompetensi" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "kompetensi.create")}
        canUpdate={hasPermission(user, "kompetensi.update")}
        canDelete={hasPermission(user, "kompetensi.delete")}
        onCreate={createKompetensiAction}
        onUpdate={updateKompetensiAction}
        onDelete={deleteKompetensiAction}
      />
      <Pagination basePath="/master/kompetensi" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
