"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { inputClass } from "@/components/ui/form";

export function JfPicker({
  options,
  value,
  basePath = "/pelatihan/matriks",
  extra = {},
}: {
  options: { value: string; label: string }[];
  value: string;
  basePath?: string;
  /** Parameter URL lain yang dipertahankan saat JF diganti (mis. tahun). */
  extra?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="jf" className="text-sm font-medium">
        Jabatan fungsional
      </label>
      <select
        id="jf"
        value={value}
        disabled={pending}
        onChange={(e) => start(() => router.replace(`${basePath}?${new URLSearchParams({ ...extra, jf: e.target.value }).toString()}`))}
        className={`${inputClass} max-w-md`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending ? <span className="text-xs text-muted">Memuat…</span> : null}
    </div>
  );
}
