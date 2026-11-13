"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { KEHADIRAN, KEHADIRAN_LABEL } from "@/lib/schemas/batch";
import type { ActionResult } from "@/server/services/master/shared";

type Row = { token: string; nama: string; nip: string; kehadiran: string; diubahOleh: string };

/** Ubah status banyak peserta lalu simpan sekali. Hanya baris yang berbeda dari data tersimpan yang dikirim. */
export function VerifikasiForm({
  rows,
  canVerify,
  onSave,
}: {
  rows: Row[];
  canVerify: boolean;
  onSave: (entries: { token: string; status: string }[]) => Promise<ActionResult<{ diubah: number }>>;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.token, r.kehadiran])));
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [pending, start] = useTransition();
  const berubah = useMemo(() => rows.filter((r) => nilai[r.token] !== r.kehadiran), [rows, nilai]);

  const set = (token: string, status: string) => {
    setPesan(null);
    setNilai((n) => ({ ...n, [token]: status }));
  };
  const semua = (status: string, hanyaTerdaftar: boolean) => {
    setPesan(null);
    setNilai((n) => Object.fromEntries(rows.map((r) => [r.token, !hanyaTerdaftar || r.kehadiran === "terdaftar" ? status : (n[r.token] ?? r.kehadiran)])));
  };
  const simpan = () =>
    start(async () => {
      const r = await onSave(berubah.map((x) => ({ token: x.token, status: nilai[x.token] ?? x.kehadiran })));
      setPesan(r.ok ? { ok: true, teks: r.data.diubah > 0 ? `${r.data.diubah} peserta diperbarui.` : "Tidak ada perubahan." } : { ok: false, teks: r.message });
    });

  return (
    <div className="space-y-3">
      {canVerify && rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => semua("hadir", true)}>Tandai yang belum terverifikasi: Hadir</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => semua("tidak_hadir", true)}>Tandai yang belum terverifikasi: Tidak hadir</Button>
          <Button size="sm" disabled={pending || berubah.length === 0} onClick={simpan}>
            {pending ? "Menyimpan…" : `Simpan perubahan${berubah.length ? ` (${berubah.length})` : ""}`}
          </Button>
          {berubah.length > 0 && !pending ? (
            <Button size="sm" variant="outline" onClick={() => setNilai(Object.fromEntries(rows.map((r) => [r.token, r.kehadiran])))}>Batalkan</Button>
          ) : null}
          {pesan ? (
            <span role={pesan.ok ? "status" : "alert"} className={`text-sm ${pesan.ok ? "text-green-600" : "text-red-500"}`}>{pesan.teks}</span>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Pegawai</th>
              <th className="px-4 py-3 font-medium">Kehadiran</th>
              <th className="px-4 py-3 font-medium">Terakhir diubah</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">Belum ada peserta.</td></tr>
            ) : (
              rows.map((r) => {
                const diubah = nilai[r.token] !== r.kehadiran;
                return (
                  <tr key={r.token} className={`border-b border-border last:border-0 ${diubah ? "bg-amber-500/10" : ""}`}>
                    <td className="px-4 py-3 align-top">{r.nama}<span className="block text-xs text-muted">{r.nip}</span></td>
                    <td className="px-4 py-3 align-top">
                      {canVerify ? (
                        <select
                          aria-label={`Kehadiran ${r.nama}`}
                          value={nilai[r.token] ?? r.kehadiran}
                          disabled={pending}
                          onChange={(e) => set(r.token, e.target.value)}
                          className={`${inputClass} w-40 py-1`}
                        >
                          {KEHADIRAN.map((k) => <option key={k} value={k}>{KEHADIRAN_LABEL[k]}</option>)}
                        </select>
                      ) : (
                        KEHADIRAN_LABEL[r.kehadiran as (typeof KEHADIRAN)[number]] ?? r.kehadiran
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted">{r.diubahOleh || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
