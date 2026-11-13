import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MutasiButton } from "@/components/pegawai/mutasi-button";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { loadPegawaiDetail, pegawaiFormOptions } from "@/server/services/pegawai";
import { mutasiPegawaiAction } from "../actions";

export const metadata: Metadata = { title: "Detail Pegawai" };
export const dynamic = "force-dynamic";

const tglId = (s: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }) : "—");

export default async function PegawaiDetailPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requirePageAccess("pegawai.view");
  const { token } = await params;
  const scope = scopeFor(user);
  let d;
  try {
    d = await loadPegawaiDetail(token, scope);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const canUpdate = hasPermission(user, "pegawai.update");
  const opts = canUpdate ? await pegawaiFormOptions(scope) : null;
  const b = d.biodata;
  const baris: [string, string][] = [
    ["NIP", b.nip], ["Nama", b.nama], ["Tempat, tgl lahir", [b.tempatLahir, b.tglLahir ? tglId(b.tglLahir) : ""].filter(Boolean).join(", ") || "—"],
    ["Jenis kelamin", b.jenisKelamin === "L" ? "Laki-laki" : b.jenisKelamin === "P" ? "Perempuan" : "—"], ["Agama", b.agama || "—"],
    ["Email", b.email || "—"], ["HP / Telepon", [b.hp, b.telp].filter(Boolean).join(" / ") || "—"],
    ["Golongan", b.golongan || "—"], ["TMT", tglId(b.tmt)], ["Pendidikan", [b.pendidikan, b.jurusan].filter(Boolean).join(" — ") || "—"],
    ["Alamat", b.alamat || "—"], ["Akun pengguna", b.punyaAkun ? "Terhubung" : "Belum ada"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/kepegawaian/pegawai" className="text-sm text-primary hover:underline">
            ← Daftar pegawai
          </Link>
          <h1 className="text-2xl font-semibold">{b.nama}</h1>
        </div>
        {canUpdate && opts ? <MutasiButton token={d.token} opts={opts} onMutasi={mutasiPegawaiAction} /> : null}
      </div>

      <section className="grid gap-x-8 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
        {baris.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <span className="w-36 shrink-0 text-muted">{k}</span>
            <span className="min-w-0 break-words">{v}</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Riwayat penempatan</h2>
        <Table>
          <THead>
            <TR>
              <TH>Periode</TH>
              <TH>Instansi / unit</TH>
              <TH>JF / jenjang</TH>
              <TH>Status</TH>
              <TH>No. SK</TH>
            </TR>
          </THead>
          <tbody>
            {d.riwayat.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-6 text-center text-muted">
                  Belum ada penempatan.
                </TD>
              </TR>
            ) : (
              d.riwayat.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">
                    {tglId(r.mulai)} – {r.aktif ? <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">aktif</span> : tglId(r.selesai)}
                  </TD>
                  <TD>
                    {r.instansi}
                    <span className="block text-xs text-muted">{[r.unitOrganisasi, r.unitKerja].filter((x) => x !== "—").join(" › ") || "—"}</span>
                  </TD>
                  <TD>
                    {r.jf}
                    <span className="block text-xs text-muted">{r.jenjang}</span>
                  </TD>
                  <TD>{r.statusPegawai}</TD>
                  <TD>{r.noSk || "—"}</TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
