"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { AGAMA_LIST } from "@/lib/schemas/pegawai";
import type { ActionResult } from "@/server/services/master/shared";
import type { PegawaiFormOptions, PegawaiRow } from "@/server/services/pegawai";
import { PenempatanFields } from "./penempatan-fields";

type Err = Record<string, string[] | undefined>;
export type Biodata = Pick<PegawaiRow, "nip" | "nama" | "email" | "hp" | "telp" | "tempatLahir" | "tglLahir" | "jenisKelamin" | "agama" | "alamat" | "pendidikan" | "jurusan" | "golongan" | "tmt">;

/** Isian biodata (dipakai tambah & ubah). `awal` = nilai awal saat ubah. */
export function BiodataFields({ opts, awal, errors }: { opts: PegawaiFormOptions; awal?: Biodata | undefined; errors: Err }) {
  const t = (name: keyof Biodata, label: string, extra: { type?: string; required?: boolean; max?: number; span?: boolean } = {}) => (
    <Field label={label} htmlFor={`b-${name}`} required={extra.required} error={errors[name]} className={extra.span ? "sm:col-span-2" : ""}>
      <input id={`b-${name}`} name={name} type={extra.type ?? "text"} defaultValue={awal?.[name] ?? ""} maxLength={extra.max ?? 255} className={inputClass} />
    </Field>
  );
  const s = (name: keyof Biodata, label: string, items: { value: string; label: string }[]) => {
    const nilai = awal?.[name] ?? "";
    const ada = !nilai || items.some((o) => o.value.toLowerCase() === nilai.toLowerCase());
    return (
      <Field label={label} htmlFor={`b-${name}`} error={errors[name]}>
        <select id={`b-${name}`} name={name} defaultValue={ada ? (items.find((o) => o.value.toLowerCase() === nilai.toLowerCase())?.value ?? "") : nilai} className={inputClass}>
          <option value="">— Tidak diisi —</option>
          {!ada ? <option value={nilai}>{nilai} (tidak ada di master)</option> : null}
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {t("nip", "NIP", { required: true, max: 30 })}
      {t("nama", "Nama lengkap", { required: true })}
      {t("tempatLahir", "Tempat lahir", { max: 100 })}
      {t("tglLahir", "Tanggal lahir", { type: "date" })}
      {s("jenisKelamin", "Jenis kelamin", [{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }])}
      {s("agama", "Agama", AGAMA_LIST.map((a) => ({ value: a, label: a })))}
      {t("email", "Email", { type: "email" })}
      {t("hp", "No. HP", { max: 30 })}
      {t("telp", "Telepon", { max: 30 })}
      {s("golongan", "Golongan", opts.golongan)}
      {t("tmt", "TMT", { type: "date" })}
      {s("pendidikan", "Pendidikan", opts.pendidikan)}
      {t("jurusan", "Jurusan", { max: 150 })}
      {t("alamat", "Alamat", { max: 500, span: true })}
    </div>
  );
}

type Props = {
  rows: PegawaiRow[];
  opts: PegawaiFormOptions;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: (fd: FormData) => Promise<ActionResult>;
  onUpdate: (token: string, fd: FormData) => Promise<ActionResult>;
  onDelete: (token: string) => Promise<ActionResult>;
};

export function PegawaiCrud({ rows, opts, canCreate, canUpdate, canDelete, onCreate, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<{ row: PegawaiRow | null } | null>(null);
  const [deleting, setDeleting] = useState<PegawaiRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Err>({});
  const [pending, start] = useTransition();

  const tutup = () => {
    setEditing(null);
    setDeleting(null);
    setError(null);
    setErrors({});
  };
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = editing?.row ?? null;
    setError(null);
    setErrors({});
    start(async () => {
      const res = row ? await onUpdate(row.id, fd) : await onCreate(fd);
      if (res.ok) tutup();
      else {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
      }
    });
  }
  function hapus() {
    if (!deleting) return;
    const row = deleting;
    setError(null);
    start(async () => {
      const res = await onDelete(row.id);
      if (res.ok) tutup();
      else setError(res.message);
    });
  }
  const alert = error ? (
    <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
      {error}
    </p>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pegawai</h1>
        {canCreate ? (
          <Button onClick={() => setEditing({ row: null })}>
            <Plus className="size-4" /> Tambah
          </Button>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>NIP</TH>
            <TH>Nama</TH>
            <TH>Instansi</TH>
            <TH>Unit kerja</TH>
            <TH>JF / Jenjang</TH>
            <TH>Status</TH>
            <TH className="w-48 text-right">Aksi</TH>
          </TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={7} className="py-8 text-center text-muted">
                Belum ada data.
              </TD>
            </TR>
          ) : (
            rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{r.nip}</TD>
                <TD>
                  {r.nama}
                  {r.punyaAkun ? <span className="ml-1.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">akun</span> : null}
                </TD>
                <TD>{r.instansi}</TD>
                <TD>{r.unitKerja}</TD>
                <TD>
                  {r.jf}
                  <span className="block text-xs text-muted">{r.jenjang}</span>
                </TD>
                <TD>{r.statusPegawai}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/kepegawaian/pegawai/${r.id}`} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-background">
                      Detail
                    </Link>
                    {canUpdate ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing({ row: r })}>
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
              </TR>
            ))
          )}
        </tbody>
      </Table>

      <Modal open={editing !== null} onClose={tutup} title={editing?.row ? "Ubah pegawai" : "Tambah pegawai"} wide>
        <form onSubmit={submit} className="space-y-4" key={editing?.row?.id ?? "baru"}>
          {alert}
          <BiodataFields opts={opts} awal={editing?.row ?? undefined} errors={errors} />
          {!editing?.row ? (
            <>
              <h3 className="border-t border-border pt-3 text-sm font-semibold">Penempatan awal</h3>
              <PenempatanFields opts={opts} errors={errors} />
            </>
          ) : (
            <p className="text-xs text-muted">Untuk mengubah penempatan (mutasi/kenaikan jenjang), buka halaman Detail pegawai.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={tutup} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={tutup} title="Hapus pegawai?">
        <div className="space-y-4">
          <p className="text-sm">
            Pegawai <strong>{deleting?.nama}</strong> ({deleting?.nip}) beserta riwayat penempatannya akan dihapus permanen.
          </p>
          {alert}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={tutup} disabled={pending}>
              Batal
            </Button>
            <Button variant="danger" onClick={hapus} disabled={pending}>
              {pending ? "Menghapus…" : "Hapus"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
