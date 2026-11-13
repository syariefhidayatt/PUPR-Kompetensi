"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { inputClass } from "@/components/ui/form";

export function SkemaPicker({ options, jf, tahun, tahunOptions }: { options: { value: string; label: string }[]; jf: string; tahun: number; tahunOptions: number[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (n: { jf?: string; tahun?: number }) =>
    start(() => router.replace(`/pelatihan/skema?${new URLSearchParams({ jf: n.jf ?? jf, tahun: String(n.tahun ?? tahun) })}`));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="jf" className="text-sm font-semibold">Pilih Jabatan Fungsional</label>
      <select id="jf" value={jf} disabled={pending} onChange={(e) => go({ jf: e.target.value })} className={`${inputClass} max-w-md`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select aria-label="Tahun" value={tahun} disabled={pending} onChange={(e) => go({ tahun: Number(e.target.value) })} className={`${inputClass} w-28`}>
        {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {pending ? <span className="text-xs text-muted">Memuat…</span> : null}
    </div>
  );
}
