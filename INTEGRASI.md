# Fase 2 — Master (Instansi, JF, Jenjang, Sertifikasi, Jenis & Sub Jenis Kompetensi)

Salin isi `src/` dan `tests/` ke repo (struktur sama dengan §3.2 dokumen teknis).

## 1. Penyesuaian ke kode Fase 0–1 (cek dulu, ini asumsi saya)
| Yang dipakai | Asumsi | Ubah di |
|---|---|---|
| `@/server/db` | export `prisma` | semua service |
| `@/server/ids` | `encodeId(bigint): string`, `decodeId(string): bigint \| null` | `shared.ts` (idOf) + service |
| `@/server/logger` | export `logger` (pino) | `shared.ts` |
| `@/server/auth` | `requirePermission(kode)`, `requireUser()` → `{ username, roles[], permissions[] }` | `guard.ts` (satu-satunya titik) |
| Prisma | model sesuai §5 sudah ada, termasuk `JenisKompetensi`, `JenisKompetensiDetail`, `Kompetensi`, `ProgramBangkom`, `Pelatihan` + pivot | `schema.prisma` |

Bila `JenisKompetensi`/`Kompetensi`/`ProgramBangkom` belum ada di `schema.prisma`, salin dari §5 lalu `npx prisma migrate dev -n fase2_jenis_kompetensi`.

## 2. Permission baru (seed)
Tambahkan `master.view` dan `master.manage`; berikan keduanya ke `admin_pusat`, dan `master.view` bila peran lain perlu melihat. Jalankan ulang `npm run db:seed`.

## 3. Komponen shadcn yang dipakai
`npx shadcn@latest add button input label switch dialog table`

## 4. Menu sidebar
Aktifkan (hapus status disabled) dan arahkan ke: `/master/jenis-kompetensi`, `/master/instansi`, `/master/jf`, `/master/jenjang`, `/master/sertifikasi` (permission `master.view`).

## 5. Verifikasi
```bash
npm run typecheck
npm test -- master-409   # butuh DATABASE_URL ke DB uji / Neon branch
```
Jenjang uji memakai `urutan = 97`; pastikan tidak bentrok dengan data di DB uji.
