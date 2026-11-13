"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";
import type { HasilUsulanBatch, PegawaiLayak } from "@/server/services/usulan-batch";

/** Usulkan pegawai untuk SATU pelatihan: hanya daftar nama pegawai, tanpa pilihan JF/pengelolaan/batch. */
export function UsulkanPelatihan({
  pelatihan,
  nama,
  sub,
  sukses = "diusulkan",
  onTutup,
  onMuat,
  onUsulkan,
}: {
  pelatihan: string;
  nama: string;
  sub?: string;
  sukses?: string;
  onTutup: () => void;
  onMuat: (pelatihan: string) => Promise<ActionResult<PegawaiLayak[]>>;
  onUsulkan: (input: {
    pelatihan: string;
    pegawai: string[];
  }) => Promise<ActionResult<HasilUsulanBatch>>;
}) {
  const [daftar, setDaftar] = useState<PegawaiLayak[] | null>(null);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [saring, setSaring] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilUsulanBatch | null>(null);
  const [menyimpan, mulaiSimpan] = useTransition();

  useEffect(() => {
    let batal = false;
    onMuat(pelatihan).then((r) => {
      if (batal) return;
      if (r.ok) setDaftar(r.data);
      else setError(r.message);
    });
    return () => {
      batal = true;
    };
  }, [pelatihan, onMuat]);

  const tampil = useMemo(() => {
    const q = saring.trim().toLowerCase();
    return (daftar ?? []).filter((p) => !q || p.nama.toLowerCase().includes(q));
  }, [daftar, saring]);
  const semua = tampil.length > 0 && tampil.every((p) => dipilih.has(p.token));

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
        if (semua) n.delete(p.token);
        else n.add(p.token);
      }
      return n;
    });

  const kirim = () => {
    setError(null);
    mulaiSimpan(async () => {
      const r = await onUsulkan({ pelatihan, pegawai: [...dipilih] });
      if (!r.ok) return setError(r.message);
      setHasil(r.data);
      const d = await onMuat(pelatihan);
      if (d.ok) setDaftar(d.data);
      setDipilih(new Set());
    });
  };

  return (
    <Modal open onClose={onTutup} title="Usulkan Pegawai">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Pelatihan: <strong className="text-foreground">{nama}</strong>
          {sub ? <span className="block text-xs">{sub}</span> : null}
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500"
          >
            {error}
          </p>
        ) : null}
        {hasil ? (
          <div
            role="status"
            className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm"
          >
            <p>
              <strong>{hasil.berhasil}</strong> pegawai berhasil {sukses}.
            </p>
            {hasil.gagal.length > 0 ? (
              <ul className="list-inside list-disc text-red-500">
                {hasil.gagal.map((g) => (
                  <li key={g.nama + g.pesan}>
                    {g.nama}: {g.pesan}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Pegawai</p>
            <p className="text-xs text-muted">({dipilih.size} dipilih)</p>
          </div>
          <input
            value={saring}
            onChange={(e) => setSaring(e.target.value)}
            placeholder="Saring nama…"
            aria-label="Saring pegawai"
            disabled={!daftar}
            className={inputClass}
          />
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            {!daftar ? (
              <p className="px-3 py-2 text-xs text-muted">
                {error ? "Gagal memuat." : "Memuat pegawai…"}
              </p>
            ) : tampil.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">
                Tidak ada pegawai yang layak diusulkan.
              </p>
            ) : (
              <ul>
                {tampil.map((p) => (
                  <li key={p.token} className="border-b border-border last:border-0">
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-background">
                      <input
                        type="checkbox"
                        checked={dipilih.has(p.token)}
                        onChange={() => toggle(p.token)}
                      />
                      {p.nama}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={semua}
              disabled={tampil.length === 0}
              onChange={toggleSemua}
            />{" "}
            Pilih semua yang tampil
          </label>
        </div>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onTutup}>
            Tutup
          </Button>
          <Button className="flex-1" disabled={menyimpan || dipilih.size === 0} onClick={kirim}>
            {menyimpan ? "Memproses…" : `Usulkan${dipilih.size ? ` (${dipilih.size})` : ""}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
