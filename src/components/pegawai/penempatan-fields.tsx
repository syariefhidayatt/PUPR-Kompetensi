"use client";

import { useMemo, useState } from "react";
import { Field, inputClass } from "@/components/ui/form";
import type { PegawaiFormOptions } from "@/server/services/pegawai";

type Err = Record<string, string[] | undefined>;

/** Isian penempatan dengan pilihan bertingkat: unit & JF hanya yang satu instansi; unit kerja mengikuti unit organisasi. */
export function PenempatanFields({ opts, errors, awalInstansi }: { opts: PegawaiFormOptions; errors: Err; awalInstansi?: string }) {
  const [instansi, setInstansi] = useState(awalInstansi ?? (opts.instansi.length === 1 ? (opts.instansi[0]?.value ?? "") : ""));
  const [uo, setUo] = useState("");
  const uos = useMemo(() => opts.unitOrganisasi.filter((x) => x.instansi === instansi), [opts, instansi]);
  const uks = useMemo(() => opts.unitKerja.filter((x) => x.instansi === instansi && (!uo || !x.uo || x.uo === uo)), [opts, instansi, uo]);
  const jfs = useMemo(() => opts.jf.filter((x) => x.instansi === instansi), [opts, instansi]);

  const sel = (id: string, name: string, label: string, items: { value: string; label: string }[], extra: { required?: boolean; onChange?: (v: string) => void; disabled?: boolean; empty?: string } = {}) => (
    <Field label={label} htmlFor={id} required={extra.required} error={errors[name]}>
      <select id={id} name={name} defaultValue="" disabled={extra.disabled} onChange={(e) => extra.onChange?.(e.target.value)} className={inputClass}>
        <option value="">{extra.required ? "Pilih…" : (extra.empty ?? "— Tidak ada —")}</option>
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Instansi" htmlFor="pn-instansi" required error={errors.instansi} className="sm:col-span-2">
        <select
          id="pn-instansi"
          name="instansi"
          value={instansi}
          onChange={(e) => {
            setInstansi(e.target.value);
            setUo("");
          }}
          className={inputClass}
        >
          <option value="">Pilih…</option>
          {opts.instansi.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {/* key = instansi agar pilihan direset saat instansi berganti */}
      <div key={`uo-${instansi}`}>{sel("pn-uo", "unitOrganisasi", "Unit organisasi", uos, { onChange: setUo, disabled: !instansi })}</div>
      <div key={`uk-${instansi}-${uo}`}>{sel("pn-uk", "unitKerja", "Unit kerja", uks, { disabled: !instansi })}</div>
      <div key={`jf-${instansi}`}>{sel("pn-jf", "jf", "Jabatan fungsional", jfs, { disabled: !instansi })}</div>
      {sel("pn-jenjang", "jenjang", "Jenjang jabatan", opts.jenjang)}
      {sel("pn-status", "statusPegawai", "Status pegawai", opts.status)}
      <Field label="Tanggal mulai" htmlFor="pn-mulai" required error={errors.tglMulai}>
        <input id="pn-mulai" name="tglMulai" type="date" className={inputClass} />
      </Field>
      <Field label="No. SK" htmlFor="pn-sk" error={errors.noSk}>
        <input id="pn-sk" name="noSk" type="text" maxLength={150} className={inputClass} />
      </Field>
      <Field label="Keterangan" htmlFor="pn-ket" error={errors.keterangan}>
        <input id="pn-ket" name="keterangan" type="text" maxLength={500} className={inputClass} />
      </Field>
    </div>
  );
}
