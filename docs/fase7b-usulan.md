# Fase 7b — Usulan pelatihan

Pasang: ekstrak zip → `npx prisma migrate dev` (menerapkan `20261111150000_fase7b_usulan_status`) → `npx prisma generate` → `npm run db:seed` (permission `usulan.*`; user perlu login ulang) → `npm run typecheck && npm test`.

Aturan: pegawai mengusulkan untuk dirinya (status `mengusulkan`); admin instansi/pusat atas nama pegawai dalam scope (status `diajukan`).
Pelatihan harus: aktif, program di JF pegawai (penempatan aktif), prasyarat jenjang terpenuhi (bila ada), dan belum ada usulan hidup (mengusulkan/diajukan/disetujui).
Batalkan: hanya `mengusulkan`/`diajukan`; di luar scope → 404.
Belum ada: persetujuan bertahap (internal → unit pembina JF → pusbangkom), jalur asn_pu/non_asn_pu, lampiran, pembuatan peserta batch, kapasitas.
