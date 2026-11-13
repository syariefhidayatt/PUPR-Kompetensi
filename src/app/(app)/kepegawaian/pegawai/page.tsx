import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { PegawaiCrud } from "@/components/pegawai/pegawai-crud";
import { filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { pageParams } from "@/server/services/master/shared";
import { listPegawai, pegawaiFormOptions } from "@/server/services/pegawai";
import { createPegawaiAction, deletePegawaiAction, updatePegawaiAction } from "./actions";

export const metadata: Metadata = { title: "Pegawai" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "nip", label: "NIP" },
  { key: "nama", label: "Nama" },
  { key: "instansi", label: "Instansi" },
  { key: "unit_organisasi", label: "Unit organisasi" },
  { key: "unit_kerja", label: "Unit kerja" },
  { key: "jf", label: "Jabatan fungsional" },
  { key: "jenjang", label: "Jenjang" },
  { key: "status_pegawai", label: "Status pegawai" },
  { key: "golongan", label: "Golongan" },
  { key: "pendidikan", label: "Pendidikan" },
  { key: "jk", label: "Jenis kelamin", type: "select", options: [{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }] },
];

export default async function PegawaiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("pegawai.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, opts] = await Promise.all([listPegawai(scope, q, page, f), pegawaiFormOptions(scope)]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari nama atau NIP…" />
      <FilterBar basePath="/kepegawaian/pegawai" defs={FILTERS} values={f} q={q} />
      <PegawaiCrud
        rows={rows}
        opts={opts}
        canCreate={hasPermission(user, "pegawai.create")}
        canUpdate={hasPermission(user, "pegawai.update")}
        canDelete={hasPermission(user, "pegawai.delete")}
        onCreate={createPegawaiAction}
        onUpdate={updatePegawaiAction}
        onDelete={deletePegawaiAction}
      />
      <Pagination basePath="/kepegawaian/pegawai" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
