import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PesertaAksi } from "@/components/usulan/peserta-row";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { BATCH_STATUS_LABEL } from "@/lib/schemas/batch";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { detailBatch } from "@/server/services/batch";
import { kehadiranAction, keluarkanPesertaAction } from "../actions";

export const metadata: Metadata = { title: "Peserta Batch" };
export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requirePageAccess("batch.view");
  const { token } = await params;
  let b;
  try {
    b = await detailBatch(scopeFor(user), token);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const canUpdate = hasPermission(user, "batch.update");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/pengelolaan/batch" className="text-sm text-primary hover:underline">
        ← Kembali ke batch
      </Link>
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <h1 className="text-xl font-semibold">{b.pelatihan}</h1>
        <p className="mt-1 text-muted">
          {b.tahun} · Angkatan {b.angkatan} · {b.mulai} s/d {b.selesai} · {b.penyelenggara}
        </p>
        <p className="mt-1">
          Status:{" "}
          <strong>
            {BATCH_STATUS_LABEL[b.status as keyof typeof BATCH_STATUS_LABEL] ?? b.status}
          </strong>{" "}
          · Peserta:{" "}
          <strong>
            {b.kapasitas === 0 ? `${b.terisi} (tanpa batas)` : `${b.terisi}/${b.kapasitas}`}
          </strong>
        </p>
        <p className="mt-2 text-xs text-muted">
          Peserta ditambahkan lewat persetujuan usulan di halaman Usulan Pelatihan.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table className="min-w-max">
          <THead>
            <TR>
              <TH>NIP</TH>
              <TH>Nama</TH>
              <TH>Jenjang Jabatan</TH>
              <TH>Status Kehadiran</TH>
              <TH>Nilai / Status Lulus</TH>
              <TH>Status Usulan</TH>
              <TH>Diusulkan Oleh</TH>
              <TH>Tanggal Usulan</TH>
            </TR>
          </THead>
          <tbody>
            {b.peserta.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-muted">
                  Belum ada peserta.
                </TD>
              </TR>
            ) : (
              b.peserta.map((p) => (
                <TR key={p.token}>
                  <TD className="whitespace-nowrap tabular-nums">{p.nip}</TD>
                  <TD className="font-medium">{p.nama}</TD>
                  <TD>{p.jenjang}</TD>
                  <TD>
                    <PesertaAksi
                      token={p.token}
                      kehadiran={p.kehadiran}
                      canUpdate={canUpdate}
                      onKehadiran={kehadiranAction}
                      onKeluarkan={keluarkanPesertaAction}
                    />
                  </TD>
                  <TD>
                    <span className="tabular-nums">{p.nilaiAkhir}</span>
                    <span className="ml-2 text-xs text-muted">{p.statusLulus}</span>
                  </TD>
                  <TD>{p.statusUsulan}</TD>
                  <TD>{p.diusulkanOleh}</TD>
                  <TD className="whitespace-nowrap">{p.tanggalUsulan}</TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
