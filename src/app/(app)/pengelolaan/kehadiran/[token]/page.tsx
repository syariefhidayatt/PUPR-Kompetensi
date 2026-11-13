import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportButtons } from "@/components/pengelolaan/export-buttons";
import { KehadiranPesertaTable } from "@/components/pengelolaan/kehadiran-peserta-table";
import { BATCH_STATUS_LABEL } from "@/lib/schemas/batch";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { detailVerifikasi } from "@/server/services/pengelolaan";
import { perbaikiKehadiranAction, simpanKehadiranAction } from "../actions";

export const metadata: Metadata = { title: "Verifikasi Kehadiran" };
export const dynamic = "force-dynamic";

export default async function VerifikasiDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const user = await requirePageAccess("kehadiran.view");
  const { token } = await params;
  let d;
  try {
    d = await detailVerifikasi(scopeFor(user), token);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const canVerify = hasPermission(user, "kehadiran.verify") && d.bisaDiverifikasi;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link href="/pengelolaan/kehadiran" className="text-sm text-primary hover:underline">
        ← Kembali ke daftar batch
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <div>
          <h1 className="text-xl font-semibold">{d.pelatihan}</h1>
          <p className="mt-1 text-muted">
            {d.tahun} - Angkatan {d.angkatan}
          </p>
          <p className="mt-1 text-muted">
            {d.mulai} s/d {d.selesai}
          </p>
          <p className="mt-1 text-muted">Penyelenggara: {d.penyelenggara}</p>
          <p className="mt-1">
            Status batch:{" "}
            <strong>
              {BATCH_STATUS_LABEL[d.status as keyof typeof BATCH_STATUS_LABEL] ?? d.status}
            </strong>{" "}
            · Peserta: <strong>{d.peserta.length}</strong>
          </p>
          {!d.bisaDiverifikasi ? (
            <p className="mt-2 text-xs text-amber-600">
              Batch ini belum dapat diverifikasi (harus terjadwal, berjalan, atau selesai).
            </p>
          ) : null}
        </div>
        <ExportButtons href={`/pengelolaan/kehadiran/${token}/export`} />
      </div>
      <KehadiranPesertaTable
        rows={d.peserta}
        canVerify={canVerify}
        pelatihan={d.pelatihan}
        namaBatch={`${d.tahun} - Angkatan ${d.angkatan}`}
        jadwalBatch={`${d.mulai} s/d ${d.selesai}`}
        penyelenggara={d.penyelenggara}
        onSave={simpanKehadiranAction.bind(null, token)}
        onRepair={perbaikiKehadiranAction.bind(null, token)}
      />
    </div>
  );
}
