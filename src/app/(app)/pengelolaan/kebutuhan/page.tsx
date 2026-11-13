import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JfSearchableSelect } from "@/components/matriks/jf-searchable-select";
import { ExportButtons } from "@/components/pengelolaan/export-buttons";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { inputClass } from "@/components/ui/form";
import { requirePageAccess } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { loadKebutuhan, type KebutuhanView } from "@/server/services/pengelolaan";

export const metadata: Metadata = { title: "Kebutuhan Pelatihan" };
export const dynamic = "force-dynamic";

const angka = (n: number) => (n > 0 ? n.toLocaleString("id-ID") : "-");

export default async function KebutuhanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePageAccess("kebutuhan.view");
  const sp = await searchParams;
  const tahunIn = /^\d{4}$/.test(sp.tahun ?? "") ? Number(sp.tahun) : undefined;

  let v: KebutuhanView;
  try {
    v = await loadKebutuhan(scopeFor(user), {
      jf: sp.jf || undefined,
      tahun: tahunIn,
      pelatihan: sp.pelatihan || undefined,
    });
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }

  const total = v.rows.reduce((a, r) => a + r.butuh, 0);
  const params = {
    jf: v.selected ?? undefined,
    tahun: String(v.tahun),
    pelatihan: v.detail?.token,
  };

  return (
    <div className="mx-auto max-w-[95rem] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kebutuhan Pelatihan</h1>
          <p className="text-sm text-muted-foreground">
            Pemetaan kebutuhan pengembangan kompetensi pegawai berdasarkan jabatan fungsional,
            program, dan jenjang jabatan.
          </p>
        </div>
        {v.selected ? <ExportButtons href="/pengelolaan/kebutuhan/export" params={params} /> : null}
      </div>

      {!v.selected ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Belum ada jabatan fungsional yang dapat ditampilkan. Pastikan master jabatan fungsional
          sudah aktif.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 print:hidden">
            <JfSearchableSelect options={v.options} value={v.selected} />
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="jf" value={v.selected} />
              <label htmlFor="tahun" className="text-sm font-medium">
                Tahun
              </label>
              <input
                id="tahun"
                name="tahun"
                type="number"
                min={2000}
                max={2100}
                defaultValue={v.tahun}
                className={`${inputClass} w-24`}
              />
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Terapkan
              </button>
            </form>
          </div>

          {v.terpotong ? (
            <p
              role="status"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600"
            >
              Jumlah pegawai melebihi batas perhitungan; hanya sebagian yang dihitung.
            </p>
          ) : null}

          {v.detail ? (
            <div className="space-y-3">
              <Link
                href={`/pengelolaan/kebutuhan?${new URLSearchParams({ jf: v.selected, tahun: String(v.tahun) })}`}
                className="text-sm text-primary hover:underline"
              >
                ← Kembali ke ringkasan
              </Link>
              <div>
                <h2 className="text-lg font-semibold">{v.detail.nama}</h2>
                <p className="text-sm text-muted-foreground">
                  Daftar pegawai yang masih membutuhkan pelatihan ini.
                </p>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <THead>
                    <TR>
                      <TH>Pegawai</TH>
                      <TH>Jenjang</TH>
                      <TH>Status kebutuhan</TH>
                      <TH>Status usulan</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {v.detail.pegawai.length === 0 ? (
                      <TR>
                        <TD colSpan={4} className="py-8 text-center text-muted-foreground">
                          Tidak ada pegawai yang membutuhkan pelatihan ini.
                        </TD>
                      </TR>
                    ) : (
                      v.detail.pegawai.map((p) => (
                        <TR key={p.nip}>
                          <TD>
                            {p.nama}
                            <span className="block text-xs text-muted-foreground">{p.nip}</span>
                          </TD>
                          <TD>{p.jenjang}</TD>
                          <TD>{p.status}</TD>
                          <TD>
                            {p.usulan || (
                              <span className="text-muted-foreground">Belum diusulkan</span>
                            )}
                          </TD>
                        </TR>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold">Matriks kebutuhan pelatihan</h2>
                <p className="text-sm text-muted-foreground">
                  Data pegawai dikelompokkan menurut jenjang jabatan. Pilih nama pelatihan untuk
                  melihat daftar pegawai yang masih membutuhkan.
                </p>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table className="min-w-max">
                  <THead>
                    <TR>
                      <TH rowSpan={2} className="sticky left-0 z-20 min-w-12 bg-card">
                        No.
                      </TH>
                      <TH rowSpan={2} className="sticky left-12 z-20 min-w-64 bg-card">
                        Nama pelatihan
                      </TH>
                      <TH rowSpan={2} className="min-w-48">
                        Program
                      </TH>
                      <TH rowSpan={2} className="min-w-48">
                        Jenis Kompetensi
                      </TH>
                      <TH rowSpan={2} className="min-w-48">
                        Jenjang Syarat
                      </TH>
                      <TH
                        colSpan={
                          v.rows[0]?.rekapJenjang.length ? v.rows[0].rekapJenjang.length + 1 : 1
                        }
                        className="text-center"
                      >
                        Kebutuhan
                      </TH>
                      <TH
                        colSpan={
                          v.rows[0]?.rekapJenjang.length ? v.rows[0].rekapJenjang.length + 1 : 1
                        }
                        className="text-center"
                      >
                        Proses Usulan
                      </TH>
                      <TH
                        colSpan={
                          v.rows[0]?.rekapJenjang.length ? v.rows[0].rekapJenjang.length + 1 : 1
                        }
                        className="text-center"
                      >
                        Sudah Ikut
                      </TH>
                    </TR>
                    <TR>
                      {v.rows[0]?.rekapJenjang.map((j) => (
                        <TH key={`kb-${j.id}`} className="text-center">
                          {j.nama}
                        </TH>
                      ))}
                      <TH className="text-center">Total</TH>
                      {v.rows[0]?.rekapJenjang.map((j) => (
                        <TH key={`us-${j.id}`} className="text-center">
                          {j.nama}
                        </TH>
                      ))}
                      <TH className="text-center">Total</TH>
                      {v.rows[0]?.rekapJenjang.map((j) => (
                        <TH key={`ik-${j.id}`} className="text-center">
                          {j.nama}
                        </TH>
                      ))}
                      <TH className="text-center">Total</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {v.rows.length === 0 ? (
                      <TR>
                        <TD
                          colSpan={8 + (v.rows[0]?.rekapJenjang.length ?? 0) * 3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Belum ada data pelatihan aktif untuk jabatan fungsional ini. Periksa
                          master program bangkom dan data pelatihan.
                        </TD>
                      </TR>
                    ) : (
                      v.rows.map((r, i) => (
                        <TR key={r.token} className="hover:bg-muted/20">
                          <TD className="sticky left-0 z-10 bg-card">{i + 1}</TD>
                          <TD className="sticky left-12 z-10 bg-card">
                            <div className="font-medium">
                              {r.butuh > 0 ? (
                                <Link
                                  href={`/pengelolaan/kebutuhan?${new URLSearchParams({ jf: v.selected!, tahun: String(v.tahun), pelatihan: r.token })}`}
                                  className="text-primary hover:underline"
                                >
                                  {r.nama}
                                </Link>
                              ) : (
                                r.nama
                              )}
                            </div>
                            {r.refresh > 0 ? (
                              <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                {r.refresh}
                              </span>
                            ) : null}
                          </TD>
                          <TD>{r.program || "-"}</TD>
                          <TD>{r.jenisKompetensi || "-"}</TD>
                          <TD>{r.jenjangSyarat || "-"}</TD>
                          {r.rekapJenjang.map((j) => (
                            <TD key={`kb-${j.id}`} className="text-center tabular-nums">
                              {angka(j.kebutuhan)}
                            </TD>
                          ))}
                          <TD className="text-center font-semibold tabular-nums">
                            {angka(r.butuh)}
                          </TD>
                          {r.rekapJenjang.map((j) => (
                            <TD key={`us-${j.id}`} className="text-center tabular-nums">
                              {angka(j.prosesUsulan)}
                            </TD>
                          ))}
                          <TD className="text-center font-semibold tabular-nums">
                            {angka(r.sudahUsul)}
                          </TD>
                          {r.rekapJenjang.map((j) => (
                            <TD key={`ik-${j.id}`} className="text-center tabular-nums">
                              {angka(j.sudahIkut)}
                            </TD>
                          ))}
                          <TD className="text-center font-semibold tabular-nums">
                            {angka(r.rekapJenjang.reduce((a, j) => a + j.sudahIkut, 0))}
                          </TD>
                        </TR>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
