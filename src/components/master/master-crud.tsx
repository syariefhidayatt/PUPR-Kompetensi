"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { UsulkanPelatihan } from "@/components/pelatihan/usulkan-pelatihan";
import type { ActionResult } from "@/server/services/master/shared";
import type { HasilUsulanBatch, PegawaiLayak } from "@/server/services/usulan-batch";
import { StatusBadge } from "./status-badge";
import type { ColumnDef, CreateAction, DeleteAction, FieldDef, MasterRow, UpdateAction } from "./types";

type Props = {
  title: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  rows: MasterRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: CreateAction;
  onUpdate: UpdateAction;
  onDelete: DeleteAction;
  /** Bila diisi, tiap baris punya tautan "Detail" ke `${detailHref}/${row.id}`. */
  detailHref?: string;
  /**
   * Bila diisi, tiap baris (batch draft/terjadwal yang aktif) punya tombol "Usulkan Pegawai" khusus batch itu:
   * `row.id` = token batch, `row.pelatihan` = token pelatihan, `row.judul` = nama batch.
   */
  usulkan?: {
    onMuat: (pelatihan: string) => Promise<ActionResult<PegawaiLayak[]>>;
    onUsulkan: (input: { pelatihan: string; batch: string; pegawai: string[] }) => Promise<ActionResult<HasilUsulanBatch>>;
  };
};

export function MasterCrud({ title, fields, columns, rows, canCreate, canUpdate, canDelete, onCreate, onUpdate, onDelete, detailHref, usulkan }: Props) {
  const [usul, setUsul] = useState<MasterRow | null>(null);
  const [editing, setEditing] = useState<{ row: MasterRow | null } | null>(null);
  const [deleting, setDeleting] = useState<MasterRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  const closeAll = () => {
    setEditing(null);
    setDeleting(null);
    setError(null);
    setFieldErrors({});
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = editing?.row ?? null;
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = row ? await onUpdate(row.id, fd) : await onCreate(fd);
      if (res.ok) closeAll();
      else {
        setError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
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
      else setError(res.message); // mis. 409: masih dipakai
    });
  }

  const showActions = canUpdate || canDelete || Boolean(detailHref) || Boolean(usulkan);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {canCreate ? (
          <Button onClick={() => setEditing({ row: null })}>
            <Plus className="size-4" /> Tambah
          </Button>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR>
            {columns.map((c) => (
              <TH key={c.key}>{c.label}</TH>
            ))}
            {showActions ? <TH className="text-right">Aksi</TH> : null}
          </TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={columns.length + (showActions ? 1 : 0)} className="py-8 text-center text-muted">
                Belum ada data.
              </TD>
            </TR>
          ) : (
            rows.map((row) => (
              <TR key={row.id}>
                {columns.map((c) => (
                  <TD key={c.key}>
                    {c.kind === "bool" ? <StatusBadge aktif={Boolean(row[c.key])} /> : String(row[c.key] ?? "—")}
                  </TD>
                ))}
                {showActions ? (
                  <TD className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {usulkan && row.statusAktif && (row.statusBatch === "draft" || row.statusBatch === "terjadwal") ? (
                        <Button size="sm" variant="outline" onClick={() => setUsul(row)}>
                          Usulkan Pegawai
                        </Button>
                      ) : null}
                      {detailHref ? (
                        <Link href={`${detailHref}/${row.id}`} className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs hover:bg-background">
                          Peserta
                        </Link>
                      ) : null}
                      {canUpdate ? (
                        <Button size="sm" variant="outline" onClick={() => setEditing({ row })}>
                          Ubah
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="outline" onClick={() => setDeleting(row)}>
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

      {usul && usulkan ? (
        <UsulkanPelatihan
          key={String(usul.id)}
          pelatihan={String(usul.pelatihan)}
          nama={String(usul.pelatihanNama)}
          sub={`${String(usul.tahunPelaksanaan)} · Angkatan ${String(usul.angkatan)} · ${String(usul.jadwal)}`}
          sukses="diusulkan dan didaftarkan ke batch ini"
          onTutup={() => setUsul(null)}
          onMuat={usulkan.onMuat}
          onUsulkan={(i) => usulkan.onUsulkan({ ...i, batch: String(usul.id) })}
        />
      ) : null}

      <Modal open={editing !== null} onClose={closeAll} title={editing?.row ? `Ubah ${title}` : `Tambah ${title}`}>
        <form onSubmit={submit} className="space-y-4" key={editing?.row?.id ?? "new"}>
          {error ? (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}
          {fields.map((f) => {
            const value = editing?.row ? editing.row[f.name] : undefined;
            if (f.type === "switch") {
              return (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={f.name}
                    defaultChecked={editing?.row ? Boolean(value) : true}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {f.label}
                </label>
              );
            }
            return (
              <Field key={f.name} label={f.label} htmlFor={`f-${f.name}`} required={f.required} error={fieldErrors[f.name]}>
                {f.type === "select" ? (
                  <select id={`f-${f.name}`} name={f.name} defaultValue={String(value ?? "")} className={inputClass}>
                    {f.optional ? (
                      <option value="">— Tidak ada —</option>
                    ) : (
                      <option value="" disabled>
                        Pilih…
                      </option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    id={`f-${f.name}`}
                    name={f.name}
                    rows={3}
                    defaultValue={value === undefined || value === null ? "" : String(value)}
                    className={inputClass}
                  />
                ) : (
                  <input
                    id={`f-${f.name}`}
                    name={f.name}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    defaultValue={value === undefined || value === null ? "" : String(value)}
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                )}
              </Field>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeAll} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={closeAll} title="Hapus data?">
        <div className="space-y-4">
          <p className="text-sm">
            Data <strong>{deleting ? String(deleting[columns[0]?.key ?? "id"] ?? "") : ""}</strong> akan dihapus
            permanen.
          </p>
          {error ? (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
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
