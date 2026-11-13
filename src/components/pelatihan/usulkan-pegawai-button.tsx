"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActionResult } from "@/server/services/master/shared";

type Pegawai = { token: string; nama: string; nip: string };
type LoadAction = (batchToken: string, q: string) => Promise<ActionResult<Pegawai[]>>;
type SaveAction = (batchToken: string, pegawaiTokens: string[]) => Promise<ActionResult>;

export function UsulkanPegawaiButton({ batchToken, onLoad, onSave }: {
  batchToken: string; onLoad: LoadAction; onSave: SaveAction;
}) {
  const [open, setOpen] = useState(false);
  const [pegawai, setPegawai] = useState<Pegawai[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function buka() {
    setOpen(true); setError("");
    if (loaded) return;
    start(async () => {
      const result = await onLoad(batchToken, "");
      if (result.ok) { setPegawai(result.data); setLoaded(true); }
      else setError(result.message);
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? pegawai.filter(p => p.nama.toLocaleLowerCase().includes(q) || p.nip.toLowerCase().includes(q)) : pegawai;
  }, [pegawai, query]);

  function toggle(token: string) {
    setSelected(prev => prev.includes(token) ? prev.filter(x => x !== token) : [...prev, token]);
  }

  function simpan() {
    setError("");
    start(async () => {
      const result = await onSave(batchToken, selected);
      if (result.ok) {
        setOpen(false); setSelected([]); setQuery(""); setLoaded(false); router.refresh();
      } else setError(result.message);
    });
  }

  return (
    <>
      <Button size="sm" onClick={buka}>＋ Usulkan pegawai</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Usulkan pegawai ke batch" wide>
        <div className="space-y-3">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama atau NIP pegawai…" aria-label="Cari nama atau NIP pegawai"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{filtered.length} pegawai ditemukan</span><span>{selected.length} dipilih</span>
          </div>
          {error ? <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
            {pending && !loaded ? <p className="p-4 text-sm text-muted">Memuat data pegawai…</p> : filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted">{loaded ? "Pegawai tidak ditemukan." : "Belum ada data."}</p>
            ) : filtered.map(p => (
              <label key={p.token} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-background">
                <input type="checkbox" checked={selected.includes(p.token)} onChange={() => toggle(p.token)} />
                <span className="text-sm">{p.nama}<span className="block text-xs text-muted">{p.nip}</span></span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button onClick={simpan} disabled={pending || selected.length === 0}>
              {pending ? "Memproses…" : `Tambahkan ${selected.length ? `(${selected.length})` : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
