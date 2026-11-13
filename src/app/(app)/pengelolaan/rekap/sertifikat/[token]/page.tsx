import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requirePageAccess } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { detailSertifikat } from "@/server/services/pengelolaan";

export const metadata: Metadata = { title: "Sertifikat" };
export const dynamic = "force-dynamic";

export default async function SertifikatPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requirePageAccess("rekap.view");
  const { token } = await params;
  let r;
  try {
    r = await detailSertifikat(scopeFor(user), token);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/pengelolaan/rekap" className="text-sm text-primary hover:underline">← Kembali ke rekap</Link>
        <PrintButton />
      </div>
      <article className="rounded-lg border-4 border-double border-border bg-card p-10 text-center print:border-black print:bg-white print:text-black">
        <p className="text-xs uppercase tracking-[0.3em] text-muted print:text-black">Sertifikat</p>
        <p className="mt-2 text-sm">Nomor: <strong>{r.noSertifikat}</strong></p>
        <p className="mt-8 text-sm">Diberikan kepada</p>
        <h1 className="mt-2 text-3xl font-semibold">{r.nama}</h1>
        <p className="text-sm text-muted print:text-black">NIP {r.nip}</p>
        <p className="mt-8 text-sm">atas keberhasilannya menyelesaikan pelatihan</p>
        <h2 className="mt-2 text-2xl font-semibold">{r.pelatihan}</h2>
        <p className="mt-2 text-sm">
          Angkatan {r.angkatan} · {r.mulai} s/d {r.selesai}
          {r.penyelenggara ? <><br />Penyelenggara: {r.penyelenggara}</> : null}
        </p>
        <p className="mt-6 text-sm">Nilai akhir: <strong>{r.nilai || "—"}</strong>{r.tanggalLulus ? ` · Tanggal lulus ${r.tanggalLulus}` : ""}</p>
      </article>
    </div>
  );
}
