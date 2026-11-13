# Rekonsiliasi skema: DB CI4 (pupr_kompetensi_ci.sql) vs Prisma

Sumber: dump PostgreSQL 16 dari aplikasi CI4. Cakupan pencocokan: tabel master + Bangkom
(Instansi, JF, Jenjang, Sertifikasi, Jenis/Sub Jenis, Kompetensi, Program, Pelatihan + 3 pivot).
Tabel pegawai, unit, batch, penyelenggara, usulan: belum dicocokkan (ditahan).

## Hasil

| Hal | CI4 | Prisma | Tindakan |
|---|---|---|---|
| Kolom & relasi Kompetensi, Program, Pelatihan, 3 pivot | sesuai | sesuai | — |
| Unik Kompetensi (jf, jenis_detail, nama), Program (jf, jenis_detail, nama), JF (instansi, nama), Jenis, Sub Jenis, Sertifikasi, Jenjang(nama) | ada | ada (nama dibuat case-insensitive) | — |
| **Jenjang `urutan`** | **tidak unik**; dua rumpun berbagi urutan 1–4 (Pertama/Muda/Madya/Utama dan Pemula/Terampil/Mahir/Penyelia) | `@unique` (SALAH) | **Diperbaiki**: unik dihapus, cek urutan dibuang, seed disesuaikan |
| Unik Instansi | (nama, jenis) | nama saja (lebih ketat) | Dipertahankan; cek duplikat nama lintas jenis sebelum migrasi data |
| Hapus data master | soft delete (`deleted_at`); nama diberi akhiran ` (Deleted <ts>)` | hard delete + guard 409 | Dipertahankan. Saat migrasi data, baris ber-`deleted_at` TIDAK diimpor (±27 baris uji) |
| Sub Jenis | tanpa `deleted_at` | sama | — |
| `created_by` | NOT NULL, berisi username/NIP | nullable | Isi dari audit saat migrasi |
| `pelatihan.k_periode` | tahun (mis. 2026) | CHECK 2000–2100 | Cocok |
| `pelatihan.k_refreshment` | tahun (mis. 5) | CHECK 1–10 | Cocok |
| `pelatihan.kategori_pelatihan` | `Dasar` / `Teknis` | komentar salah ("Wajib/Pilihan") | Komentar diperbaiki |
| `pelatihan.jenis_pelatihan` | `Mutlak` (nilai lain belum terlihat) | teks bebas | Perlu daftar nilai lengkap (Fase 5) |
| `program_bangkom.kategori` | `Wajib` / `Pilihan` (ada salah ketik `Piihan` di data uji) | teks bebas | Normalisasi saat migrasi |

## Keputusan (10 Nov 2026)
1. `jenis_pelatihan` dan `kategori_pelatihan` dibuat **teks bebas** untuk sementara (tanpa enum). Normalisasi nilai ditinjau lagi setelah data produksi bersih tersedia.
2. Learning Path membandingkan jenjang **hanya dalam satu rumpun** (Keahlian atau Keterampilan). Konsekuensi untuk Fase 7: CI4 tidak punya kolom rumpun pada jenjang, jadi perlu kolom `rumpun` di `JenjangJabatan` atau penentuan lewat JF. **Diputuskan: tambah kolom `rumpun` (enum KEAHLIAN | KETERAMPILAN) pada `JenjangJabatan`** — sudah dikerjakan; Learning Path Fase 7 membandingkan `urutan` hanya bila `rumpun` sama. Kolom ini tidak ada di CI4; saat migrasi data diisi dari nama jenjang (Pertama/Muda/Madya/Utama → KEAHLIAN; Pemula/Terampil/Mahir/Penyelia → KETERAMPILAN).

## Pertanyaan terbuka
- Data di dump sebagian besar data uji (mis. Instansi/JF/Program dengan akhiran "Deleted", akun `superadmin`).
  Migrasi data produksi sebaiknya dari sumber yang sudah dibersihkan.
