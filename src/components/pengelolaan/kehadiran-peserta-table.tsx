"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { KEHADIRAN, KEHADIRAN_LABEL } from "@/lib/schemas/batch";
import type { ActionResult } from "@/server/services/master/shared";

type Row = {
  token: string;
  nama: string;
  nip: string;
  unitOrganisasi: string;
  unitKerja: string;
  jabatan: string;
  kehadiran: string;
  nilai: string;
  lulus: string;
  diubahOleh: string;
  diubahPada: string;
};
type Correction = {
  statusKehadiran: string;
  nilai: number | null;
  statusLulus: string;
  alasan: string;
};
type Save = (
  entries: { token: string; status: string }[],
) => Promise<ActionResult<{ diubah: number }>>;
type Repair = (token: string, input: Correction) => Promise<ActionResult<void>>;

const BADGE: Record<string, string> = {
  terdaftar: "bg-slate-500/15 text-muted",
  hadir: "bg-emerald-500/15 text-emerald-600",
  selesai: "bg-emerald-500/15 text-emerald-600",
  tidak_hadir: "bg-red-500/15 text-red-600",
};

export function KehadiranPesertaTable({
  rows,
  canVerify,
  pelatihan,
  namaBatch,
  jadwalBatch,
  penyelenggara,
  onSave,
  onRepair,
}: {
  rows: Row[];
  canVerify: boolean;
  pelatihan: string;
  namaBatch: string;
  jadwalBatch: string;
  penyelenggara: string;
  onSave: Save;
  onRepair: Repair;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [repairRow, setRepairRow] = useState<Row | null>(null);
  const [repair, setRepair] = useState<Correction>({
    statusKehadiran: "hadir",
    nilai: null,
    statusLulus: "lulus",
    alasan: "",
  });
  const [repairError, setRepairError] = useState("");
  const [repairMessage, setRepairMessage] = useState("");

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.includes(r.token)),
    [rows, selected],
  );
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.token));
  const toggle = (token: string) =>
    setSelected((s) => (s.includes(token) ? s.filter((x) => x !== token) : [...s, token]));
  const mark = (status: string) => {
    if (!selectedRows.length) return;
    setMessage(null);
    start(async () => {
      const result = await onSave(selectedRows.map((r) => ({ token: r.token, status })));
      setMessage(
        result.ok
          ? { ok: true, text: `${result.data.diubah} peserta diperbarui.` }
          : { ok: false, text: result.message },
      );
      if (result.ok) setSelected([]);
    });
  };
  const openRepair = (row: Row) => {
    setRepairRow(row);
    setRepair({
      statusKehadiran: row.kehadiran,
      nilai: row.nilai === "" ? null : Number(row.nilai),
      statusLulus: row.lulus || "lulus",
      alasan: "",
    });
    setRepairError("");
    setRepairMessage("");
  };
  const submitRepair = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!repairRow) return;
    if (repair.alasan.trim().length < 5) {
      setRepairError("Alasan perbaikan wajib diisi (minimal 5 karakter).");
      return;
    }
    start(async () => {
      const result = await onRepair(repairRow.token, repair);
      if (result.ok) {
        setRepairMessage("Perbaikan data berhasil disimpan.");
        setRepairRow(null);
      } else setRepairError(result.message);
    });
  };

  return (
    <div className="space-y-3">
      {canVerify ? (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <span className="text-sm font-medium">{selected.length} peserta dipilih</span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selected.length === 0}
              onClick={() => mark("hadir")}
            >
              Tandai Hadir
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selected.length === 0}
              onClick={() => mark("tidak_hadir")}
            >
              Tandai Tidak Hadir
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selected.length === 0}
              onClick={() => mark("selesai")}
            >
              Tandai Selesai
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-500"}`}
        >
          {message.text}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="border-b border-border bg-background/40 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              {canVerify ? (
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua peserta"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              <th className="px-3 py-3 font-medium">Pegawai</th>
              <th className="px-3 py-3 font-medium">Unit Organisasi / Kerja</th>
              <th className="px-3 py-3 font-medium">Pelatihan</th>
              <th className="px-3 py-3 font-medium">Jadwal Batch</th>
              <th className="px-3 py-3 font-medium">Kehadiran</th>
              <th className="px-3 py-3 font-medium">Nilai / Lulus</th>
              {canVerify ? <th className="px-3 py-3 font-medium">Aksi</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canVerify ? 8 : 6} className="px-4 py-8 text-center text-muted">
                  Belum ada peserta.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.token} className="border-b border-border last:border-0">
                  {canVerify ? (
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${row.nama}`}
                        checked={selected.includes(row.token)}
                        onChange={() => toggle(row.token)}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 align-top">
                    <strong>{row.nama}</strong>
                    <span className="block text-xs text-muted">{row.nip}</span>
                    <span className="block text-xs text-muted">{row.jabatan}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {row.unitOrganisasi}
                    <span className="block text-xs text-muted">{row.unitKerja}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <strong>{pelatihan}</strong>
                  </td>
                  <td className="px-3 py-3 align-top text-xs">
                    <strong className="block text-sm">{namaBatch}</strong>
                    <span className="block text-muted">{jadwalBatch}</span>
                    <span className="block text-muted">{penyelenggara}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${BADGE[row.kehadiran] ?? "bg-slate-500/15"}`}
                    >
                      ●{" "}
                      {KEHADIRAN_LABEL[row.kehadiran as (typeof KEHADIRAN)[number]] ??
                        row.kehadiran}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <strong>{row.nilai || "—"}</strong>
                    {row.lulus ? (
                      <span
                        className={`mt-1 block w-fit rounded-full px-2 py-1 text-xs ${row.lulus === "lulus" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}
                      >
                        ● {row.lulus === "lulus" ? "Lulus" : "Tidak Lulus"}
                      </span>
                    ) : null}
                  </td>
                  {canVerify ? (
                    <td className="px-3 py-3 align-top">
                      <Button size="sm" variant="outline" onClick={() => openRepair(row)}>
                        Perbaikan
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Modal
        open={repairRow !== null}
        onClose={() => setRepairRow(null)}
        title="Perbaikan Data Kehadiran"
      >
        {repairRow ? (
          <form className="space-y-4" onSubmit={submitRepair}>
            <p className="text-sm text-muted">
              {repairRow.nama} · {repairRow.nip}
            </p>
            <Field label="Status Kehadiran" htmlFor="repair-kehadiran" required>
              <select
                id="repair-kehadiran"
                className={inputClass}
                value={repair.statusKehadiran}
                onChange={(e) => setRepair((v) => ({ ...v, statusKehadiran: e.target.value }))}
              >
                {KEHADIRAN.map((s) => (
                  <option key={s} value={s}>
                    {KEHADIRAN_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nilai" htmlFor="repair-nilai">
              <input
                id="repair-nilai"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className={inputClass}
                value={repair.nilai ?? ""}
                onChange={(e) =>
                  setRepair((v) => ({
                    ...v,
                    nilai: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="0–100"
              />
            </Field>
            <Field label="Status Lulus" htmlFor="repair-lulus" required>
              <select
                id="repair-lulus"
                className={inputClass}
                value={repair.statusLulus}
                onChange={(e) => setRepair((v) => ({ ...v, statusLulus: e.target.value }))}
              >
                <option value="lulus">Lulus</option>
                <option value="tidak_lulus">Tidak Lulus</option>
              </select>
            </Field>
            <Field label="Alasan Perbaikan" htmlFor="repair-alasan" required>
              <textarea
                id="repair-alasan"
                className={inputClass}
                rows={3}
                maxLength={1000}
                value={repair.alasan}
                onChange={(e) => setRepair((v) => ({ ...v, alasan: e.target.value }))}
                placeholder="Jelaskan alasan perubahan data..."
              />
            </Field>
            {repairError ? (
              <p role="alert" className="text-sm text-red-500">
                {repairError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setRepairRow(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan Perbaikan"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
      {repairMessage ? (
        <p role="status" className="text-sm text-emerald-600">
          {repairMessage}
        </p>
      ) : null}
    </div>
  );
}
