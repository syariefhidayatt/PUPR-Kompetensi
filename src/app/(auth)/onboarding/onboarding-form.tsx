"use client";

import { useActionState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/ui/form";
import { AGAMA, STATUS_PEGAWAI } from "@/lib/schemas/onboarding";
import { submitOnboarding, type OnboardingState } from "./actions";

type Option = { token: string; label: string };

export function OnboardingForm({
  defaultNama,
  email,
  instansi,
  jf,
  jenjang,
}: {
  defaultNama: string;
  email: string;
  instansi: Option[];
  jf: Option[];
  jenjang: Option[];
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(submitOnboarding, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      {state?.error ? (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">A. Biodata</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="NIP / NIPPPK" htmlFor="nip" required error={fe.nip}>
            <input id="nip" name="nip" inputMode="numeric" maxLength={18} className={inputClass} />
          </Field>
          <Field label="Nama lengkap" htmlFor="nama" required error={fe.nama}>
            <input id="nama" name="nama" defaultValue={defaultNama} className={inputClass} />
          </Field>
          <Field label="Email (dari Google)" htmlFor="email">
            <input id="email" value={email} readOnly disabled className={inputClass} />
          </Field>
          <Field label="No. HP" htmlFor="hp" error={fe.hp}>
            <input id="hp" name="hp" inputMode="tel" className={inputClass} />
          </Field>
          <Field label="Telepon" htmlFor="telp" error={fe.telp}>
            <input id="telp" name="telp" inputMode="tel" className={inputClass} />
          </Field>
          <Field label="Tempat lahir" htmlFor="tempatLahir" error={fe.tempatLahir}>
            <input id="tempatLahir" name="tempatLahir" className={inputClass} />
          </Field>
          <Field label="Tanggal lahir" htmlFor="tglLahir" error={fe.tglLahir}>
            <input id="tglLahir" name="tglLahir" type="date" className={inputClass} />
          </Field>
          <Field label="Jenis kelamin" htmlFor="jenisKelamin" error={fe.jenisKelamin}>
            <select id="jenisKelamin" name="jenisKelamin" defaultValue="" className={inputClass}>
              <option value="">—</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </Field>
          <Field label="Agama" htmlFor="agama" error={fe.agama}>
            <select id="agama" name="agama" defaultValue="" className={inputClass}>
              <option value="">—</option>
              {AGAMA.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pendidikan terakhir" htmlFor="pendidikan" error={fe.pendidikan}>
            <input id="pendidikan" name="pendidikan" placeholder="mis. S1" className={inputClass} />
          </Field>
          <Field label="Jurusan" htmlFor="jurusan" error={fe.jurusan}>
            <input id="jurusan" name="jurusan" className={inputClass} />
          </Field>
          <Field label="Golongan" htmlFor="golongan" error={fe.golongan}>
            <input id="golongan" name="golongan" placeholder="mis. III/a" className={inputClass} />
          </Field>
          <Field label="TMT" htmlFor="tmt" error={fe.tmt}>
            <input id="tmt" name="tmt" type="date" className={inputClass} />
          </Field>
          <Field label="Alamat" htmlFor="alamat" error={fe.alamat} className="md:col-span-2">
            <textarea id="alamat" name="alamat" rows={2} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">B. Penempatan awal</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Instansi (Pemerintah Daerah)" htmlFor="instansi" required error={fe.instansi}>
            <select id="instansi" name="instansi" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pilih instansi
              </option>
              {instansi.map((o) => (
                <option key={o.token} value={o.token}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jabatan Fungsional" htmlFor="jf" required error={fe.jf}>
            <select id="jf" name="jf" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pilih JF
              </option>
              {jf.map((o) => (
                <option key={o.token} value={o.token}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jenjang jabatan" htmlFor="jenjang" required error={fe.jenjang}>
            <select id="jenjang" name="jenjang" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pilih jenjang
              </option>
              {jenjang.map((o) => (
                <option key={o.token} value={o.token}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status pegawai" htmlFor="statusPegawai" required error={fe.statusPegawai}>
            <select id="statusPegawai" name="statusPegawai" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pilih status
              </option>
              {STATUS_PEGAWAI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="TMT penempatan" htmlFor="tglMulai" required error={fe.tglMulai}>
            <input id="tglMulai" name="tglMulai" type="date" className={inputClass} />
          </Field>
          <Field label="No. SK" htmlFor="noSk" error={fe.noSk}>
            <input id="noSk" name="noSk" className={inputClass} />
          </Field>
          <Field label="Keterangan" htmlFor="keterangan" error={fe.keterangan} className="md:col-span-2">
            <textarea id="keterangan" name="keterangan" rows={2} className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Unit organisasi/unit kerja dapat dilengkapi admin kemudian.
        </p>
      </fieldset>

      <SubmitButton pending={pending}>Simpan &amp; lanjutkan</SubmitButton>
    </form>
  );
}
