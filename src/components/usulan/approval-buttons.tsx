"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";

type Mode = "setuju" | "tolak" | "daftar" | null;
type Act = (token: string, fd: FormData) => Promise<ActionResult>;

export function ApprovalButtons({
  token,
  label,
  status,
  punyaPeserta,
  batchPilihan,
  onSetuju,
  onTolak,
  onDaftar,
}: {
  token: string;
  label: string;
  status: string;
  punyaPeserta: boolean;
  batchPilihan: { token: string; label: string }[];
  onSetuju: Act;
  onTolak: Act;
  onDaftar: Act;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  const tutup = () => {
    setMode(null);
    setError(null);
    setFieldErrors({});
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const act = mode === "setuju" ? onSetuju : mode === "tolak" ? onTolak : onDaftar;
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = await act(token, fd);
      if (res.ok) tutup();
      else {
        setError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  const belumDiputus = status === "mengusulkan" || status === "diajukan";
  const perluDaftar = status === "disetujui" && !punyaPeserta;
  if (!belumDiputus && !perluDaftar) return null;

  const batchSelect = (wajib: boolean) => (
    <Field label={wajib ? "Batch" : "Daftarkan ke batch (opsional)"} htmlFor="ap-batch" required={wajib} error={fieldErrors.batch}>
      <select id="ap-batch" name="batch" defaultValue="" className={inputClass}>
        <option value="">{wajib ? "Pilih…" : "(setujui saja, daftarkan nanti)"}</option>
        {batchPilihan.map((b) => (
          <option key={b.token} value={b.token}>{b.label}</option>
        ))}
      </select>
      {batchPilihan.length === 0 ? <p className="text-xs text-muted">Belum ada batch terbuka untuk pelatihan ini. Buat dulu di menu Batch Pelatihan.</p> : null}
    </Field>
  );

  return (
    <>
      <div className="flex justify-end gap-2">
        {belumDiputus ? (
          <>
            <Button size="sm" onClick={() => setMode("setuju")}>Setujui</Button>
            <Button size="sm" variant="outline" onClick={() => setMode("tolak")}>Tolak</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setMode("daftar")}>Daftarkan ke batch</Button>
        )}
      </div>
      <Modal open={mode !== null} onClose={tutup} title={mode === "tolak" ? "Tolak usulan" : mode === "daftar" ? "Daftarkan ke batch" : "Setujui usulan"}>
        <form onSubmit={submit} className="space-y-4" key={mode ?? "x"}>
          <p className="text-sm">Pelatihan: <strong>{label}</strong></p>
          {error ? <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
          {mode === "tolak" ? (
            <Field label="Alasan penolakan" htmlFor="ap-alasan" required error={fieldErrors.alasan}>
              <textarea id="ap-alasan" name="alasan" rows={3} maxLength={1000} className={inputClass} />
            </Field>
          ) : (
            batchSelect(mode === "daftar")
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={tutup} disabled={pending}>Batal</Button>
            <Button type="submit" variant={mode === "tolak" ? "danger" : "primary"} disabled={pending}>
              {pending ? "Memproses…" : mode === "tolak" ? "Tolak" : mode === "daftar" ? "Daftarkan" : "Setujui"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
