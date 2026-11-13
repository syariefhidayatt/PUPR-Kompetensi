# Fase 10 — Pengelolaan

Menu baru **Pengelolaan** (sidebar) dengan tiga halaman, semuanya bisa diunduh sebagai Excel dan PDF.

| Halaman | URL | Permission |
|---|---|---|
| Kebutuhan Pelatihan | `/pengelolaan/kebutuhan` | `kebutuhan.view` |
| Verifikasi Kehadiran | `/pengelolaan/kehadiran` (+ `/[token]`) | `kehadiran.view`, ubah: `kehadiran.verify` |
| Rekap Peserta | `/pengelolaan/rekap` | `rekap.view` |

Permission baru berlaku setelah `npm run db:seed` dan login ulang. admin_pusat: semua; admin_instansi: semua (scope instansi); pembina: hanya view.

## Kebutuhan Pelatihan
Per jabatan fungsional + tahun. Memakai aturan Learning Path yang sama (`hitungStatus`) untuk setiap pegawai dengan penempatan aktif di JF itu.
Pegawai "butuh" sebuah pelatihan bila di salah satu kolom jenjang (dalam rumpunnya) statusnya **wajib sekarang**, **terlewat**, atau **perlu refresh**.
Kolom: wajib / terlewat / refresh / total butuh / belum diusulkan / batch tersedia (draft atau terjadwal). Klik nama pelatihan untuk daftar pegawainya.
Batas perhitungan 5.000 pegawai per JF.

## Verifikasi Kehadiran
Daftar batch terjadwal/berjalan/selesai → detail peserta. Ubah status beberapa peserta lalu **Simpan perubahan** (satu transaksi, hanya baris yang berubah ditulis, audit `kehadiran.verifikasi`).
Jejak: `updatedBy` / `updatedAt` pada peserta. Batch draft/dibatalkan ditolak (409).

## Rekap Peserta
Tab **Per peserta** (paginasi) dan **Per batch** (agregat). Filter: pegawai, pelatihan, instansi, tahun, kehadiran, kelulusan, status batch. Ekspor memakai filter yang sama (maks. 20.000 baris).

## Ekspor
`?format=xlsx|pdf`. Satu pola di `src/server/export/handler.ts`: login → permission (tanpa izin = 404) → rate limit 10/menit → bangun tabel (scope dipaksa di service) → audit `export.<key>`.
PDF (jspdf + jspdf-autotable) memakai font Helvetica bawaan, jadi karakter di luar Latin-1 diganti `?`. Sel Excel selalu teks (aman dari injeksi rumus).
Perlu `npm install` (paket baru: `jspdf`, `jspdf-autotable`).
