import type { Metadata } from "next";
import { FilterBar } from "@/components/master/filter-bar";
import { STATUS_OPTIONS, filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { MasterCrud } from "@/components/master/master-crud";
import { BATCH_STATUS, BATCH_STATUS_LABEL } from "@/lib/schemas/batch";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { batchFormOptions, listBatch } from "@/server/services/batch";
import { pageParams } from "@/server/services/master/shared";
import { UsulkanPegawai } from "@/components/pelatihan/usulkan-pegawai";
import { opsiUsulanBatch } from "@/server/services/usulan-batch";
import {
  createBatchAction,
  deleteBatchAction,
  muatPegawaiLayakAction,
  updateBatchAction,
  usulkanPegawaiAction,
} from "./actions";

export const metadata: Metadata = { title: "Batch Pelatihan" };
export const dynamic = "force-dynamic";

const FILTERS: FilterDef[] = [
  { key: "pelatihan", label: "Pelatihan" },
  { key: "penyelenggara", label: "Penyelenggara" },
  { key: "tahun", label: "Tahun", type: "number" },
  { key: "angkatan", label: "Angkatan" },
  {
    key: "status_batch",
    label: "Status batch",
    type: "select",
    options: BATCH_STATUS.map((s) => ({ value: s, label: BATCH_STATUS_LABEL[s] })),
  },
  { key: "status", label: "Aktif", type: "select", options: STATUS_OPTIONS },
];

export default async function BatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageAccess("batch.view");
  const scope = scopeFor(user);
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const canUsulkan = hasPermission(user, "usulan.approve") && scope.kind !== "self";
  const [{ rows, total }, opt, opsiUsulan] = await Promise.all([
    listBatch(scope, q, page, f),
    batchFormOptions(scope),
    canUsulkan
      ? opsiUsulanBatch({
          username: user.username,
          idUser: BigInt(user.id),
          roles: user.roles,
          scope,
        })
      : Promise.resolve(null),
  ]);

  const data = rows.map((r) => ({
    ...r,
    // Kolom dipakai MasterCrud: kolom [0] menjadi nama di dialog hapus.
    judul: `${r.pelatihanNama} (${r.tahunPelaksanaan}, angkatan ${r.angkatan})`,
    jadwal: `${r.tanggalMulai} s/d ${r.tanggalSelesai}`,
    kursi: r.kapasitas === 0 ? `${r.terisi} (tanpa batas)` : `${r.terisi}/${r.kapasitas}`,
    statusLabel:
      BATCH_STATUS_LABEL[r.statusBatch as (typeof BATCH_STATUS)[number]] ?? r.statusBatch,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar q={q} extra={fp} placeholder="Cari pelatihan, angkatan, atau penyelenggara…" />
        {opsiUsulan ? (
          <UsulkanPegawai
            opsi={opsiUsulan}
            onMuat={muatPegawaiLayakAction}
            onUsulkan={usulkanPegawaiAction}
          />
        ) : null}
      </div>
      <FilterBar basePath="/pengelolaan/batch" defs={FILTERS} values={f} q={q} />
      <MasterCrud
        title="Batch Pelatihan"
        detailHref="/pengelolaan/batch"
        {...(opsiUsulan
          ? { usulkan: { onMuat: muatPegawaiLayakAction, onUsulkan: usulkanPegawaiAction } }
          : {})}
        fields={[
          {
            name: "pelatihan",
            label: "Pelatihan",
            type: "select",
            required: true,
            options: opt.pelatihan,
          },
          {
            name: "penyelenggara",
            label: "Penyelenggara",
            type: "select",
            options: [{ value: "", label: "(tanpa penyelenggara)" }, ...opt.penyelenggara],
          },
          { name: "tahunPelaksanaan", label: "Tahun pelaksanaan", type: "number", required: true },
          { name: "angkatan", label: "Angkatan", type: "text", required: true, placeholder: "I" },
          { name: "tanggalMulai", label: "Tanggal mulai", type: "date", required: true },
          { name: "tanggalSelesai", label: "Tanggal selesai", type: "date", required: true },
          {
            name: "kapasitas",
            label: "Kapasitas (0 = tanpa batas)",
            type: "number",
            required: true,
          },
          {
            name: "statusBatch",
            label: "Status batch",
            type: "select",
            required: true,
            options: BATCH_STATUS.map((s) => ({ value: s, label: BATCH_STATUS_LABEL[s] })),
          },
          { name: "keterangan", label: "Keterangan", type: "textarea" },
          { name: "statusAktif", label: "Aktif", type: "switch" },
        ]}
        columns={[
          { key: "judul", label: "Batch" },
          { key: "penyelenggaraNama", label: "Penyelenggara" },
          { key: "jadwal", label: "Jadwal" },
          { key: "kursi", label: "Peserta" },
          { key: "statusLabel", label: "Status" },
          { key: "statusAktif", label: "Aktif", kind: "bool" },
        ]}
        rows={data}
        canCreate={hasPermission(user, "batch.create")}
        canUpdate={hasPermission(user, "batch.update")}
        canDelete={hasPermission(user, "batch.delete")}
        onCreate={createBatchAction}
        onUpdate={updateBatchAction}
        onDelete={deleteBatchAction}
      />
      <Pagination basePath="/pengelolaan/batch" page={page} total={total} q={q} extra={fp} />
    </div>
  );
}
