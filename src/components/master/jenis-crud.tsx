"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import type { CreateAction, DeleteAction, JenisRow, UpdateAction } from "./types";

type DraftDetail = { key: string; id?: string; namaDetail: string; statusAktif: boolean };
type Draft = { token?: string; namaJenis: string; statusAktif: boolean; details: DraftDetail[] };

let counter = 0;
const newKey = () => `d${++counter}`;

export function JenisCrud({
  rows,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
}: {
  rows: JenisRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onCreate: CreateAction;
  onUpdate: UpdateAction;
  onDelete: DeleteAction;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<JenisRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  const closeAll = () => {
    setDraft(null);
    setDeleting(null);
    setError(null);
    setFieldErrors({});
  };

  const openCreate = () => setDraft({ namaJenis: "", statusAktif: true, details: [] });
  const openEdit = (r: JenisRow) =>
    setDraft({
      token: r.id,
      namaJenis: r.namaJenis,
      statusAktif: r.statusAktif,
      details: r.details.map((d) => ({ key: newKey(), id: d.id, namaDetail: d.namaDetail, statusAktif: d.statusAktif })),
    });

  const patchDetail = (key: string, patch: Partial<DraftDetail>) =>
    setDraft((d) => (d ? { ...d, details: d.details.map((x) => (x.key === key ? { ...x, ...patch } : x)) } : d));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const fd = new FormData();
    fd.set("namaJenis", draft.namaJenis);
    if (draft.statusAktif) fd.set("statusAktif", "on");
    fd.set(
      "details",
      JSON.stringify(draft.details.map((d) => ({ id: d.id, namaDetail: d.namaDetail, statusAktif: d.statusAktif }))),
    );
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = draft.token ? await onUpdate(draft.token, fd) : await onCreate(fd);
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
      else setError(res.message);
    });
  }

  const showActions = canUpdate || canDelete;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jenis Kompetensi</h1>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Tambah
          </Button>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Jenis</TH>
            <TH>Sub jenis</TH>
            <TH>Status</TH>
            {showActions ? <TH className="w-40 text-right">Aksi</TH> : null}
          </TR>
        </THead>
        <tbody>
          {rows.length === 0 ? (
            <TR>
              <TD colSpan={showActions ? 4 : 3} className="py-8 text-center text-muted">
                Belum ada data.
              </TD>
            </TR>
          ) : (
            rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.namaJenis}</TD>
                <TD>
                  {r.details.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {r.details.map((d) => (
                        <li
                          key={d.id}
                          className={
                            d.statusAktif
                              ? "rounded border border-border px-2 py-0.5 text-xs"
                              : "rounded border border-border px-2 py-0.5 text-xs text-muted line-through"
                          }
                        >
                          {d.namaDetail}
                        </li>
                      ))}
                    </ul>
                  )}
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

      <Modal open={draft !== null} onClose={closeAll} title={draft?.token ? "Ubah Jenis Kompetensi" : "Tambah Jenis Kompetensi"} wide>
        {draft ? (
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </p>
            ) : null}
            <Field label="Nama jenis" htmlFor="namaJenis" required error={fieldErrors.namaJenis}>
              <input
                id="namaJenis"
                value={draft.namaJenis}
                onChange={(e) => setDraft({ ...draft, namaJenis: e.target.value })}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.statusAktif}
                onChange={(e) => setDraft({ ...draft, statusAktif: e.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              Aktif
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sub jenis</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({ ...draft, details: [...draft.details, { key: newKey(), namaDetail: "", statusAktif: true }] })
                  }
                >
                  <Plus className="size-3.5" /> Tambah sub jenis
                </Button>
              </div>
              {fieldErrors.details ? <p className="text-xs text-red-500">{fieldErrors.details[0]}</p> : null}
              {draft.details.length === 0 ? <p className="text-xs text-muted">Belum ada sub jenis.</p> : null}
              {draft.details.map((d) => (
                <div key={d.key} className="flex items-center gap-2">
                  <input
                    value={d.namaDetail}
                    onChange={(e) => patchDetail(d.key, { namaDetail: e.target.value })}
                    placeholder="Nama sub jenis"
                    aria-label="Nama sub jenis"
                    className={inputClass}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={d.statusAktif}
                      onChange={(e) => patchDetail(d.key, { statusAktif: e.target.checked })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Aktif
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Buang sub jenis"
                    onClick={() => setDraft({ ...draft, details: draft.details.filter((x) => x.key !== d.key) })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted">
                Sub jenis yang masih dipakai kompetensi/program tidak dapat dibuang.
              </p>
            </div>

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

      <Modal open={deleting !== null} onClose={closeAll} title="Hapus jenis kompetensi?">
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{deleting?.namaJenis}</strong> beserta {deleting?.details.length ?? 0} sub jenisnya akan dihapus
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
