import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { KATEGORI_PROGRAM } from "@/lib/schemas/master";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { jenisDetailOptions } from "@/server/services/master/jenis-kompetensi";
import { jfOptions } from "@/server/services/master/jf";
import { listProgram } from "@/server/services/master/program-bangkom";
import { pageParams } from "@/server/services/master/shared";
import { createProgramAction, deleteProgramAction, updateProgramAction } from "./actions";

export const metadata: Metadata = { title: "Program Bangkom" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "instansi", label: "Instansi" },
  { key: "jf", label: "Jabatan fungsional" },
  { key: "jenis", label: "Jenis" },
  { key: "sub", label: "Sub jenis" },
  { key: "nama", label: "Program" },
  { key: "kategori", label: "Kategori", type: "select", options: [{ value: "Wajib", label: "Wajib" }, { value: "Pilihan", label: "Pilihan" }] },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default async function ProgramBangkomPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePageAccess("program_bangkom.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const [{ rows, total }, jf, detail] = await Promise.all([
    listProgram(scope, q, page, f),
    jfOptions(scope),
    jenisDetailOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SearchBar q={q} extra={fp} placeholder="Cari program, JF, instansi, atau sub jenis…" />
      <FilterBar basePath="/program/bangkom" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Program Bangkom"
        fields={[
          { name: "jf", label: "Jabatan fungsional", type: "select", required: true, options: jf },
          { name: "jenisDetail", label: "Jenis › sub jenis", type: "select", required: true, options: detail },
          { name: "namaProgram", label: "Nama program", type: "text", required: true },
          {
            name: "kategori",
            label: "Kategori",
            type: "select",
            options: [{ value: "", label: "— Tanpa kategori —" }, ...KATEGORI_PROGRAM.map((k) => ({ value: k, label: k }))],
          },
          { name: "deskripsi", label: "Deskripsi", type: "textarea" },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "instansiNama", label: "Instansi" },
          { key: "jfSaja", label: "JF" },
          { key: "jenisLabel", label: "Jenis" },
          { key: "namaProgram", label: "Program" },
          { key: "kategori", label: "Kategori" },
          { key: "statusAktif", label: "Status", kind: "bool" },
        ]}
        rows={rows}
        canCreate={hasPermission(user, "program_bangkom.create")}
        canUpdate={hasPermission(user, "program_bangkom.update")}
        canDelete={hasPermission(user, "program_bangkom.delete")}
        onCreate={createProgramAction}
        onUpdate={updateProgramAction}
        onDelete={deleteProgramAction}
      />
      <Pagination basePath="/program/bangkom" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
