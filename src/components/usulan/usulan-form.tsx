"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import type { ActionResult } from "@/server/services/master/shared";

type Props = {
  pegawaiToken: string;
  untukDiriSendiri: boolean;
  pilihan: { token: string; label: string }[];
  awal?: string | undefined; // token pelatihan terpilih dari tautan Learning Path
  onCreate: (fd: FormData) => Promise<ActionResult>;
};

export function UsulanForm({ pegawaiToken, untukDiriSendiri, pilihan, awal, onCreate }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setFieldErrors({});
    setOk(false);
    start(async () => {
      const res = await onCreate(fd);
      if (res.ok) {
        setOk(true);
        form.reset();
        router.refresh();
      } else {
        setError(res.message);
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  if (pilihan.length === 0) {
    return <p className="text-sm text-muted">Tidak ada pelatihan yang dapat diusulkan saat ini (semua sudah diusulkan atau tidak memenuhi syarat).</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      ) : null}
      {ok ? <p role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">Usulan berhasil dibuat.</p> : null}
      <input type="hidden" name="pegawai" value={untukDiriSendiri ? "" : pegawaiToken} />
      <Field label="Pelatihan" htmlFor="u-pelatihan" required error={fieldErrors.pelatihan}>
        <select id="u-pelatihan" name="pelatihan" defaultValue={pilihan.some((p) => p.token === awal) ? awal : ""} className={inputClass}>
          <option value="" disabled>Pilih…</option>
          {pilihan.map((p) => (
            <option key={p.token} value={p.token}>{p.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Alasan (opsional)" htmlFor="u-alasan" error={fieldErrors.alasan}>
        <textarea id="u-alasan" name="alasan" rows={3} maxLength={1000} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Mengirim…" : "Ajukan usulan"}</Button>
    </form>
  );
}
