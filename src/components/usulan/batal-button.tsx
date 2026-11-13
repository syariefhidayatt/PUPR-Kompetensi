"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";

export function BatalButton({ token, label, onBatal }: { token: string; label: string; onBatal: (t: string) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tutup = () => {
    setOpen(false);
    setError(null);
  };
  function konfirmasi() {
    setError(null);
    start(async () => {
      const res = await onBatal(token);
      if (res.ok) tutup();
      else setError(res.message);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Batalkan</Button>
      <Modal open={open} onClose={tutup} title="Batalkan usulan?">
        <div className="space-y-4">
          <p className="text-sm">Usulan <strong>{label}</strong> akan dibatalkan. Anda dapat mengusulkannya lagi nanti.</p>
          {error ? <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={tutup} disabled={pending}>Kembali</Button>
            <Button variant="danger" onClick={konfirmasi} disabled={pending}>{pending ? "Memproses…" : "Batalkan usulan"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
