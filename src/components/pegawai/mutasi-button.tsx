"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";
import type { PegawaiFormOptions } from "@/server/services/pegawai";
import { PenempatanFields } from "./penempatan-fields";

export function MutasiButton({ token, opts, onMutasi }: { token: string; opts: PegawaiFormOptions; onMutasi: (token: string, fd: FormData) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const tutup = () => {
    setOpen(false);
    setError(null);
    setErrors({});
  };
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setErrors({});
    start(async () => {
      const res = await onMutasi(token, fd);
      if (res.ok) tutup();
      else {
        setError(res.message);
        setErrors(res.fieldErrors ?? {});
      }
    });
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Ubah penempatan</Button>
      <Modal open={open} onClose={tutup} title="Ubah penempatan (mutasi / perubahan jabatan)" wide>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-muted">Penempatan saat ini ditutup sehari sebelum tanggal mulai yang baru; riwayat tetap tersimpan.</p>
          {error ? (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          ) : null}
          <PenempatanFields opts={opts} errors={errors} />
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
    </>
  );
}
