import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/master/filter-bar";
import { Pagination, SearchBar } from "@/components/master/list-controls";
import { filterParams, readFilters, type FilterDef } from "@/lib/filters";
import { ApprovalButtons } from "@/components/usulan/approval-buttons";
import { BatalButton } from "@/components/usulan/batal-button";
import { UsulanForm } from "@/components/usulan/usulan-form";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePageAccess } from "@/server/auth/guards";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { cariPegawai } from "@/server/services/learning-path";
import { pageParams } from "@/server/services/master/shared";
import { listUsulan, loadFormUsulan, type Aktor, type FormUsulan } from "@/server/services/usulan";
import { STATUS_LABEL } from "@/server/services/usulan-rules";
import {
  batalkanUsulanAction,
  createUsulanAction,
  daftarBatchAction,
  setujuiUsulanAction,
  tolakUsulanAction,
} from "./actions";

const FILTERS: FilterDef[] = [
  { key: "pegawai", label: "Pegawai (nama/NIP)" },
  { key: "pelatihan", label: "Pelatihan" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "mengusulkan", label: "Diusulkan" },
      { value: "diajukan", label: "Diajukan" },
    ],
  },
  { key: "oleh", label: "Diusulkan oleh" },
];

export const metadata: Metadata = { title: "Usulan Pelatihan" };
export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  mengusulkan: "bg-primary/15 text-primary",
  diajukan: "bg-primary/15 text-primary",
};

export default async function UsulanPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pegawai?: string;
    pelatihan?: string;
    cari?: string;
  }>;
}) {
  const user = await requirePageAccess("usulan.view");
  const sp = await searchParams;
  const { page, q } = pageParams(sp);
  const f = readFilters(sp);
  const fp = filterParams(f);
  const scope = scopeFor(user);
  const aktor: Aktor = {
    username: user.username,
    idUser: BigInt(user.id),
    roles: user.roles,
    scope,
  };
  const canCreate = hasPermission(user, "usulan.create");
  const canCancel = hasPermission(user, "usulan.update");
  const canApprove = hasPermission(user, "usulan.approve");
  const canPick = scope.kind !== "self";

  let form: FormUsulan | null = null;
  if (canCreate) {
    try {
      form = await loadFormUsulan(aktor, sp.pegawai || undefined);
    } catch (e) {
      if (e instanceof AppError && e.status === 404) notFound();
      throw e;
    }
  }
  const [{ rows, total }, hasil] = await Promise.all([
    listUsulan(aktor, { page, q, withBatch: canApprove, f }),
    canCreate && canPick && sp.cari
      ? cariPegawai({ idUser: aktor.idUser, scope, canPick }, sp.cari.slice(0, 100))
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">Usulan Pelatihan</h1>

      {canCreate && form ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="font-medium">Buat usulan</h2>
          {canPick ? (
            <div className="space-y-2">
              <form method="get" className="flex gap-2">
                <input
                  name="cari"
                  defaultValue={sp.cari ?? ""}
                  maxLength={100}
                  placeholder="Cari pegawai (nama atau NIP)…"
                  className="w-72 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-2 text-sm hover:bg-background"
                >
                  Cari
                </button>
              </form>
              {sp.cari ? (
                hasil.length === 0 ? (
                  <p className="text-sm text-muted">Tidak ada pegawai yang cocok.</p>
                ) : (
                  <ul className="text-sm">
                    {hasil.map((h) => (
                      <li key={h.token}>
                        <Link
                          href={`/pengelolaan/usulan?pegawai=${encodeURIComponent(h.token)}`}
                          className="text-primary hover:underline"
                        >
                          {h.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : null}

          {form.state === "perlu_pegawai" ? (
            <p className="text-sm text-muted">Cari dan pilih pegawai terlebih dahulu.</p>
          ) : form.state === "tidak_ada_pegawai" ? (
            <p className="text-sm text-muted">
              Akun Anda belum terhubung ke data pegawai. Hubungi admin.
            </p>
          ) : form.state === "belum_penempatan" ? (
            <p className="text-sm text-muted">
              {form.pegawai.nama} belum memiliki penempatan aktif dengan jabatan fungsional dan
              jenjang, sehingga belum dapat mengusulkan pelatihan.
            </p>
          ) : (
            <>
              <p className="text-sm">
                Untuk: <strong>{form.pegawai.nama}</strong>{" "}
                <span className="text-muted">({form.pegawai.nip})</span>
                {!form.untukDiriSendiri ? (
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                    atas nama pegawai
                  </span>
                ) : null}
              </p>
              <UsulanForm
                key={form.pegawai.token}
                pegawaiToken={form.pegawai.token}
                untukDiriSendiri={form.untukDiriSendiri}
                pilihan={form.pilihan}
                awal={sp.pelatihan}
                onCreate={createUsulanAction}
              />
            </>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <SearchBar q={q} extra={fp} placeholder="Cari pegawai, NIP, atau pelatihan…" />
        <FilterBar basePath="/pengelolaan/usulan" defs={FILTERS} values={f} q={q} />
        <Table>
          <THead>
            <TR>
              <TH>Pegawai</TH>
              <TH>Unit Organisasi / Kerja</TH>
              <TH>Pelatihan</TH>
              <TH>Diusulkan</TH>
              <TH>Jadwal Batch</TH>
              <TH>Status</TH>
              {canCancel || canApprove ? <TH className="w-56 text-right">Aksi</TH> : null}
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD
                  colSpan={canCancel || canApprove ? 7 : 6}
                  className="py-8 text-center text-muted"
                >
                  Belum ada usulan.
                </TD>
              </TR>
            ) : (
              rows.map((r) => (
                <TR key={r.token}>
                  <TD>
                    <strong>{r.pegawai}</strong>
                    <span className="block text-xs text-muted">{r.nip}</span>
                    <span className="block text-xs text-muted">{r.jabatan}</span>
                  </TD>
                  <TD>
                    <span className="block">{r.unitOrganisasi}</span>
                    <span className="block text-xs text-muted">{r.unitKerja}</span>
                  </TD>
                  <TD>{r.pelatihan}</TD>
                  <TD className="whitespace-nowrap">
                    <strong>
                      {r.tanggal.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                    </strong>
                    <span className="block text-xs text-muted">oleh {r.oleh}</span>
                  </TD>
                  <TD>
                    {r.batchJadwal ? (
                      <span className="text-sm">{r.batchJadwal}</span>
                    ) : (
                      <span className="text-xs text-muted">Belum dijadwalkan</span>
                    )}
                  </TD>
                  <TD>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${BADGE[r.status] ?? "bg-amber-500/15 text-amber-600"}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </TD>
                  {canCancel || canApprove ? (
                    <TD className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {canApprove ? (
                          <ApprovalButtons
                            token={r.token}
                            label={r.pelatihan}
                            status={r.status}
                            punyaPeserta={r.punyaPeserta}
                            batchPilihan={r.batchPilihan}
                            onSetuju={setujuiUsulanAction}
                            onTolak={tolakUsulanAction}
                            onDaftar={daftarBatchAction}
                          />
                        ) : null}
                        {canCancel && r.bisaBatal ? (
                          <BatalButton
                            token={r.token}
                            label={r.pelatihan}
                            onBatal={batalkanUsulanAction}
                          />
                        ) : null}
                      </div>
                    </TD>
                  ) : null}
                </TR>
              ))
            )}
          </tbody>
        </Table>
        <Pagination
          basePath="/pengelolaan/usulan"
          page={page}
          total={total}
          q={q}
          extra={{ ...fp, ...(sp.pegawai ? { pegawai: sp.pegawai } : {}) }}
        />
      </section>
    </div>
  );
}
