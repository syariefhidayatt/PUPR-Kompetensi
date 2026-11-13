"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { KEHADIRAN, KEHADIRAN_LABEL } from "@/lib/schemas/batch";
import type { ActionResult } from "@/server/services/master/shared";

export function PesertaAksi({
  token,
  kehadiran,
  canUpdate,
  onKehadiran,
  onKeluarkan,
}: {
  token: string;
  kehadiran: string;
  canUpdate: boolean;
  onKehadiran: (t: string, s: string) => Promise<ActionResult>;
  onKeluarkan: (t: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = KEHADIRAN_LABEL[kehadiran as (typeof KEHADIRAN)[number]] ?? kehadiran;
  if (!canUpdate) return <span>{label}</span>;

  const jalan = (fn: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Status kehadiran"
        defaultValue={kehadiran}
        disabled={pending}
        onChange={(e) => jalan(() => onKehadiran(token, e.target.value))}
        className={`${inputClass} w-36 py-1`}
      >
        {KEHADIRAN.map((k) => (
          <option key={k} value={k}>{KEHADIRAN_LABEL[k]}</option>
        ))}
      </select>
      {kehadiran === "terdaftar" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => jalan(() => onKeluarkan(token))}>Keluarkan</Button>
      ) : null}
      {error ? <span role="alert" className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}
