import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { JenisCrud } from "@/components/master/jenis-crud";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission } from "@/server/auth/rbac";
import { listJenis } from "@/server/services/master/jenis-kompetensi";
import { pageParams } from "@/server/services/master/shared";
import { createJenisAction, deleteJenisAction, updateJenisAction } from "./actions";

export const metadata: Metadata = { title: "Jenis Kompetensi" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nama", label: "Jenis" },
  { key: "sub", label: "Sub jenis" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function JenisKompetensiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("jenis_kompetensi.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const { rows, total } = await listJenis(q, page, f);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari jenis atau sub jenis…" />
      <FilterBar basePath="/master/jenis-kompetensi" defs={FILTERS} values={f} q={q} />
      <JenisCrud
        rows={rows}
        canCreate={hasPermission(user, "jenis_kompetensi.create")}
        canUpdate={hasPermission(user, "jenis_kompetensi.update")}
        canDelete={hasPermission(user, "jenis_kompetensi.delete")}
        onCreate={createJenisAction}
        onUpdate={updateJenisAction}
        onDelete={deleteJenisAction}
      />
      <Pagination basePath="/master/jenis-kompetensi" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
