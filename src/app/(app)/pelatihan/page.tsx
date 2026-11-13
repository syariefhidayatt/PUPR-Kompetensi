import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { YA_TIDAK_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import Link from "next/link";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { PelatihanCrud } from "@/components/pelatihan/pelatihan-crud";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { listPelatihan, pelatihanFormOptions, type StatusFilter } from "@/server/services/master/pelatihan";
import { pageParams } from "@/server/services/master/shared";
import { createPelatihanAction, deletePelatihanAction, updatePelatihanAction } from "./actions";

export const metadata: Metadata = { title: "Pelatihan" };
export const dynamic = "force-dynamic";

const parseStatus = (v: string | undefined): StatusFilter => (v === "aktif" || v === "nonaktif" ? v : undefined);

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "jf", label: "Jabatan fungsional" },
  { key: "program", label: "Program" },
  { key: "nama", label: "Pelatihan" },
  { key: "jenis", label: "Jenis pelatihan" },
  { key: "kategori", label: "Kategori" },
  { key: "sertifikat", label: "Bersertifikat", type: "select", options: YA_TIDAK_OPTIONS },
  { key: "refreshment", label: "Refreshment", type: "select", options: YA_TIDAK_OPTIONS },
];

export default async function PelatihanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageAccess("pelatihan.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const status = parseStatus(sp.status);
  const [{ rows, total }, options] = await Promise.all([listPelatihan(scope, q, status, page, f), pelatihanFormOptions(scope)]);

  const tab = (label: string, value: StatusFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("status", value);
    const href = params.size ? `/pelatihan?${params}` : "/pelatihan";
    const active = status === value;
    return (
      <Link
        key={label}
        href={href}
        className={`rounded-md border px-3 py-1.5 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-background"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar q={q} extra={fp} placeholder="Cari pelatihan, program, JF, atau instansi…" />
      <FilterBar basePath="/pelatihan" defs={FILTERS} values={f} q={q} />
        <div className="flex gap-2">
          {tab("Semua", undefined)}
          {tab("Aktif", "aktif")}
          {tab("Nonaktif", "nonaktif")}
        </div>
      </div>
      <PelatihanCrud
        rows={rows}
        options={options}
        canCreate={hasPermission(user, "pelatihan.create")}
        canUpdate={hasPermission(user, "pelatihan.update")}
        canDelete={hasPermission(user, "pelatihan.delete")}
        onCreate={createPelatihanAction}
        onUpdate={updatePelatihanAction}
        onDelete={deletePelatihanAction}
      />
      <Pagination basePath="/pelatihan" page={page} total={total} q={q} extra={{ ...fp, ...(status ? { status } : {}) }} />
    </div>
  );
}
