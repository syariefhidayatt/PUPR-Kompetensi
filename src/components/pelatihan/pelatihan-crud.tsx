"use client";

import { Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { StatusBadge } from "@/components/master/status-badge";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type {
  Option,
  PelatihanCreateAction,
  PelatihanDeleteAction,
  PelatihanFormOptions,
  PelatihanRow,
  PelatihanUpdateAction,
} from "./types";

type Draft = {
  token?: string;
  originalProgram?: string;
  originalKompetensi: Option[];
  program: string;
  namaPelatihan: string;
  deskripsi: string;
  jenisPelatihan: string;
  kategoriPelatihan: string;
  isPeriode: boolean;
  kPeriode: string;
  isRefreshment: boolean;
  kRefreshment: string;
  isSertifikat: boolean;
  statusAktif: boolean;
  jenjang: string[];
  kompetensi: string[];
  sertifikasi: string[];
};

const EMPTY: Draft = {
  originalKompetensi: [],
  program: "",
  namaPelatihan: "",
  deskripsi: "",
  jenisPelatihan: "",
  kategoriPelatihan: "",
  isPeriode: false,
  kPeriode: String(new Date().getFullYear()),
  isRefreshment: false,
  kRefreshment: "",
  isSertifikat: false,
  statusAktif: true,
  jenjang: [],
  kompetensi: [],
  sertifikasi: [],
};

function CheckList({
  options,
  selected,
  onChange,
  empty,
}: {
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
  empty: string;
}) {
  if (options.length === 0) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              checked={selected.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value))}
            />
            <span>{o.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

const Err = ({ msg }: { msg?: string[] | undefined }) => (msg?.length ? <p className="text-xs text-red-500">{msg[0]}</p> : null);

export function PelatihanCrud({
  rows,
  options,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
}: {
  rows: PelatihanRow[];
  options: PelatihanFormOptions;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: PelatihanCreateAction;
  onUpdate: PelatihanUpdateAction;
  onDelete: PelatihanDeleteAction;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<PelatihanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  const closeAll = () => {
    setDraft(null);
    setDeleting(null);
    setError(null);
    setFe({});
  };

  const openEdit = (r: PelatihanRow) =>
    setDraft({
      token: r.id,
      originalProgram: r.program,
      originalKompetensi: r.kompetensi,
      program: r.program,
      namaPelatihan: r.namaPelatihan,
      deskripsi: r.deskripsi,
      jenisPelatihan: r.jenisPelatihan,
      kategoriPelatihan: r.kategoriPelatihan,
      isPeriode: r.isPeriode,
      kPeriode: r.kPeriode === null ? String(new Date().getFullYear()) : String(r.kPeriode),
      isRefreshment: r.isRefreshment,
      kRefreshment: r.kRefreshment === null ? "" : String(r.kRefreshment),
      isSertifikat: r.isSertifikat,
      statusAktif: r.statusAktif,
      jenjang: r.jenjang,
      kompetensi: r.kompetensi.map((k) => k.value),
      sertifikasi: r.sertifikasi,
    });

  // Kompetensi yang boleh dipilih = milik program terpilih (JF + sub jenis sama). Yang sudah terhubung tetap tampil bila program tidak berubah.
  const kompOptions = useMemo<Option[]>(() => {
    if (!draft) return [];
    const base = options.programs.find((p) => p.value === draft.program)?.kompetensi ?? [];
    if (draft.originalProgram !== draft.program) return base;
    const extra = draft.originalKompetensi.filter((k) => !base.some((b) => b.value === k.value)).map((k) => ({ ...k, label: `${k.label} (nonaktif)` }));
    return [...base, ...extra];
  }, [draft, options.programs]);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  function changeProgram(value: string) {
    setDraft((d) => {
      if (!d) return d;
      const allowed = new Set(options.programs.find((p) => p.value === value)?.kompetensi.map((k) => k.value));
      const keep = d.originalProgram === value ? new Set(d.originalKompetensi.map((k) => k.value)) : new Set<string>();
      return { ...d, program: value, kompetensi: d.kompetensi.filter((k) => allowed.has(k) || keep.has(k)) };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const fd = new FormData();
    fd.set("program", draft.program);
    fd.set("namaPelatihan", draft.namaPelatihan);
    fd.set("deskripsi", draft.deskripsi);
    fd.set("jenisPelatihan", draft.jenisPelatihan);
    fd.set("kategoriPelatihan", draft.kategoriPelatihan);
    if (draft.isPeriode) fd.set("isPeriode", "on");
    fd.set("kPeriode", draft.isPeriode ? draft.kPeriode : "");
    if (draft.isRefreshment) fd.set("isRefreshment", "on");
    fd.set("kRefreshment", draft.isRefreshment ? draft.kRefreshment : "");
    if (draft.isSertifikat) fd.set("isSertifikat", "on");
    if (draft.statusAktif) fd.set("statusAktif", "on");
    fd.set("jenjang", JSON.stringify(draft.jenjang));
    fd.set("kompetensi", JSON.stringify(draft.kompetensi));
    fd.set("sertifikasi", JSON.stringify(draft.isSertifikat ? draft.sertifikasi : []));
    setError(null);
    setFe({});
    start(async () => {
      const res = draft.token ? await onUpdate(draft.token, fd) : await onCreate(fd);
      if (res.ok) closeAll();
      else {
        setError(res.message);
        setFe(res.fieldErrors ?? {});
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const row = deleting;
    setError(null);
    start(async () => {
      const res = await onDelete(row.id);
      if (res.ok) closeAll();
      else setError(res.message);
    });
  }

  const showActions = canUpdate || canDelete;
  const alertCls = "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pelatihan</h1>
        {canCreate ? (
          <Button onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="size-4" /> Tambah
          </Button>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Pelatihan</TH>
            <TH>Program</TH>
            <TH>Jenjang</TH>
            <TH>Periode</TH>
            <TH>Status</TH>
            {showActions ? <TH className="w-40 text-right">Aksi</TH> : null}
          </TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={showActions ? 6 : 5} className="py-8 text-center text-muted">
                Belum ada data.
              </TD>
            </TR>
          ) : (
            rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <div className="font-medium">{r.namaPelatihan}</div>
                  <div className="text-xs text-muted">
                    {[r.kategoriPelatihan, r.jenisPelatihan, r.isSertifikat ? "Bersertifikat" : ""].filter(Boolean).join(" · ")}
                  </div>
                </TD>
                <TD className="text-xs">{r.programLabel}</TD>
                <TD className="text-xs">{r.jenjangLabels.join(", ")}</TD>
                <TD className="text-xs">
                  {r.kPeriode ?? "—"}
                  {r.isRefreshment && r.kRefreshment ? (
                    <div className="text-muted">
                      tiap {r.kRefreshment} th{r.dibukaLagi ? ` · dibuka lagi ${r.dibukaLagi}` : ""}
                    </div>
                  ) : null}
                </TD>
                <TD>
                  <StatusBadge aktif={r.statusAktif} />
                </TD>
                {showActions ? (
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          Ubah
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="outline" onClick={() => setDeleting(r)}>
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))
          )}
        </tbody>
      </Table>

      <Modal open={draft !== null} onClose={closeAll} title={draft?.token ? "Ubah Pelatihan" : "Tambah Pelatihan"} wide>
        {draft ? (
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p role="alert" className={alertCls}>
                {error}
              </p>
            ) : null}

            <Field label="Program" htmlFor="program" required error={fe.program}>
              <select id="program" value={draft.program} onChange={(e) => changeProgram(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  Pilih…
                </option>
                {options.programs.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama pelatihan" htmlFor="namaPelatihan" required error={fe.namaPelatihan}>
              <input id="namaPelatihan" value={draft.namaPelatihan} onChange={(e) => patch({ namaPelatihan: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Deskripsi" htmlFor="deskripsi" error={fe.deskripsi}>
              <textarea id="deskripsi" rows={3} value={draft.deskripsi} onChange={(e) => patch({ deskripsi: e.target.value })} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jenis pelatihan" htmlFor="jenisPelatihan" error={fe.jenisPelatihan}>
                <input id="jenisPelatihan" list="dl-jenis" value={draft.jenisPelatihan} onChange={(e) => patch({ jenisPelatihan: e.target.value })} className={inputClass} />
                <datalist id="dl-jenis">
                  <option value="Mutlak" />
                </datalist>
              </Field>
              <Field label="Kategori pelatihan" htmlFor="kategoriPelatihan" error={fe.kategoriPelatihan}>
                <input id="kategoriPelatihan" list="dl-kategori" value={draft.kategoriPelatihan} onChange={(e) => patch({ kategoriPelatihan: e.target.value })} className={inputClass} />
                <datalist id="dl-kategori">
                  <option value="Dasar" />
                  <option value="Teknis" />
                </datalist>
              </Field>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">
                Jenjang <span className="text-red-500">*</span>
              </span>
              <CheckList options={options.jenjang} selected={draft.jenjang} onChange={(v) => patch({ jenjang: v })} empty="Belum ada jenjang." />
              <Err msg={fe.jenjang} />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">
                Kompetensi <span className="text-red-500">*</span>
              </span>
              <CheckList
                options={kompOptions}
                selected={draft.kompetensi}
                onChange={(v) => patch({ kompetensi: v })}
                empty={draft.program ? "Program ini belum punya kompetensi aktif (JF dan sub jenis sama)." : "Pilih program terlebih dahulu."}
              />
              <Err msg={fe.kompetensi} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.isPeriode} onChange={(e) => patch({ isPeriode: e.target.checked })} />
                  Berperiode
                </label>
                {draft.isPeriode ? (
                  <Field label="Tahun periode" htmlFor="kPeriode" error={fe.kPeriode}>
                    <input id="kPeriode" type="number" value={draft.kPeriode} onChange={(e) => patch({ kPeriode: e.target.value })} className={inputClass} />
                  </Field>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.isRefreshment} onChange={(e) => patch({ isRefreshment: e.target.checked })} />
                  Refreshment
                </label>
                {draft.isRefreshment ? (
                  <Field label="Interval (tahun)" htmlFor="kRefreshment" error={fe.kRefreshment}>
                    <input id="kRefreshment" type="number" value={draft.kRefreshment} onChange={(e) => patch({ kRefreshment: e.target.value })} className={inputClass} />
                  </Field>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.isSertifikat} onChange={(e) => patch({ isSertifikat: e.target.checked })} />
                Menghasilkan sertifikat
              </label>
              {draft.isSertifikat ? (
                <>
                  <CheckList options={options.sertifikasi} selected={draft.sertifikasi} onChange={(v) => patch({ sertifikasi: v })} empty="Belum ada sertifikasi." />
                  <Err msg={fe.sertifikasi} />
                </>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={draft.statusAktif} onChange={(e) => patch({ statusAktif: e.target.checked })} />
              Aktif
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeAll} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={deleting !== null} onClose={closeAll} title="Hapus pelatihan?">
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{deleting?.namaPelatihan}</strong> akan dihapus permanen beserta kaitan jenjang, kompetensi, dan sertifikasinya.
          </p>
          {error ? (
            <p role="alert" className={alertCls}>
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeAll} disabled={pending}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={pending}>
              {pending ? "Menghapus…" : "Hapus"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
