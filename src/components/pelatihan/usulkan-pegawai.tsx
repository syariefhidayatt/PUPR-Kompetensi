"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";
import type { HasilUsulanBatch, OpsiUsulanBatch, PegawaiLayak } from "@/server/services/usulan-batch";

type Props = {
  opsi: OpsiUsulanBatch;
  onMuat: (pelatihan: string) => Promise<ActionResult<PegawaiLayak[]>>;
  onUsulkan: (input: { pelatihan: string; batch: string; pegawai: string[] }) => Promise<ActionResult<HasilUsulanBatch>>;
};

/** Modal "Usulkan Pegawai": JF → Pelatihan → Batch → pilih banyak pegawai, lalu usulkan & daftarkan ke batch sekaligus. */
export function UsulkanPegawai({ opsi, onMuat, onUsulkan }: Props) {
  const [buka, setBuka] = useState(false);
  const [jf, setJf] = useState("");
  const [pelatihan, setPelatihan] = useState("");
  const [batch, setBatch] = useState("");
  const [daftar, setDaftar] = useState<PegawaiLayak[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [saring, setSaring] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilUsulanBatch | null>(null);
  const [memuat, mulaiMuat] = useTransition();
  const [menyimpan, mulaiSimpan] = useTransition();

  const pelatihanJf = useMemo(() => opsi.pelatihan.filter((p) => p.jf === jf), [opsi, jf]);
  const batchOpsi = useMemo(() => opsi.pelatihan.find((p) => p.token === pelatihan)?.batch ?? [], [opsi, pelatihan]);
  const tampil = useMemo(() => {
    const q = saring.trim().toLowerCase();
    return (daftar ?? []).filter((p) => !q || p.nama.toLowerCase().includes(q) || p.nip.includes(q));
  }, [daftar, saring]);
  const semuaDipilih = tampil.length > 0 && tampil.every((p) => dipilih.has(p.token));

  const reset = () => {
    setJf(""); setPelatihan(""); setBatch(""); setDaftar(null); setDipilih(new Set()); setSaring(""); setError(null);
  };
  const tutup = () => {
    setBuka(false);
    reset();
    setHasil(null);
  };

  const pilihJf = (v: string) => {
    setJf(v); setPelatihan(""); setBatch(""); setDaftar(null); setDipilih(new Set()); setError(null); setHasil(null);
  };
  const pilihPelatihan = (v: string) => {
    setPelatihan(v); setBatch(""); setDaftar(null); setDipilih(new Set()); setError(null); setHasil(null);
    if (!v) return;
    mulaiMuat(async () => {
      const r = await onMuat(v);
      if (r.ok) setDaftar(r.data);
      else setError(r.message);
    });
  };
  const toggle = (t: string) =>
    setDipilih((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  const toggleSemua = () =>
    setDipilih((s) => {
      const n = new Set(s);
      for (const p of tampil) {
        if (semuaDipilih) n.delete(p.token);
        else n.add(p.token);
      }
      return n;
    });

  const kirim = () => {
    setError(null);
    mulaiSimpan(async () => {
      const r = await onUsulkan({ pelatihan, batch, pegawai: [...dipilih] });
      if (!r.ok) return setError(r.message);
      setHasil(r.data);
      // Yang berhasil tidak lagi layak (sudah punya usulan): muat ulang daftar.
      const d = await onMuat(pelatihan);
      if (d.ok) setDaftar(d.data);
      setDipilih(new Set());
    });
  };

  return (
    <>
      <Button onClick={() => setBuka(true)}>
        <UserPlus className="mr-1.5 inline size-4" /> Usulkan Pegawai
      </Button>
      <Modal open={buka} onClose={tutup} title="Usulkan Pegawai" wide>
        <div className="space-y-4">
          {error ? <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
          {hasil ? (
            <div role="status" className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
              <p><strong>{hasil.berhasil}</strong> pegawai berhasil diusulkan dan didaftarkan ke batch.</p>
              {hasil.gagal.length > 0 ? (
                <ul className="list-inside list-disc text-red-500">
                  {hasil.gagal.map((g) => <li key={g.nama + g.pesan}>{g.nama}: {g.pesan}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Field label="Jabatan Fungsional" htmlFor="ub-jf">
            <select id="ub-jf" value={jf} onChange={(e) => pilihJf(e.target.value)} className={inputClass}>
              <option value="">Pilih Jabatan Fungsional…</option>
              {opsi.jf.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Pelatihan" htmlFor="ub-pel">
            <select id="ub-pel" value={pelatihan} disabled={!jf} onChange={(e) => pilihPelatihan(e.target.value)} className={inputClass}>
              <option value="">{jf && pelatihanJf.length === 0 ? "Tidak ada pelatihan dengan batch terbuka" : "Pilih Pelatihan…"}</option>
              {pelatihanJf.map((p) => <option key={p.token} value={p.token}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Batch" htmlFor="ub-batch">
            <select id="ub-batch" value={batch} disabled={!pelatihan} onChange={(e) => setBatch(e.target.value)} className={inputClass}>
              <option value="">Pilih Batch…</option>
              {batchOpsi.map((b) => <option key={b.token} value={b.token}>{b.label}</option>)}
            </select>
          </Field>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Pegawai</p>
              <p className="text-xs text-muted">({dipilih.size} dipilih)</p>
            </div>
            <input
              value={saring}
              onChange={(e) => setSaring(e.target.value)}
              placeholder="Saring nama / NIP…"
              aria-label="Saring pegawai"
              disabled={!daftar}
              className={inputClass}
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {!pelatihan ? (
                <p className="px-3 py-2 text-xs text-muted">Pilih pelatihan terlebih dahulu.</p>
              ) : memuat || !daftar ? (
                <p className="px-3 py-2 text-xs text-muted">{error ? "Gagal memuat." : "Memuat pegawai…"}</p>
              ) : tampil.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted">Tidak ada pegawai yang layak diusulkan.</p>
              ) : (
                <ul>
                  {tampil.map((p) => (
                    <li key={p.token} className="border-b border-border last:border-0">
                      <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-background">
                        <input type="checkbox" checked={dipilih.has(p.token)} onChange={() => toggle(p.token)} className="mt-1" />
                        <span>
                          {p.nama}
                          <span className="block text-xs text-muted">{p.nip}{p.jenjang ? ` · ${p.jenjang}` : ""}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={semuaDipilih} disabled={tampil.length === 0} onChange={toggleSemua} />
              Pilih semua yang tampil
            </label>
          </div>

          <div className="flex gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={tutup}>Batal</Button>
            <Button className="flex-1" disabled={menyimpan || !pelatihan || !batch || dipilih.size === 0} onClick={kirim}>
              {menyimpan ? "Memproses…" : `Usulkan${dipilih.size ? ` (${dipilih.size})` : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
