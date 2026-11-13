# Sistem Kompetensi & Pelatihan (Next.js)

Next.js 15 · TypeScript · Tailwind v4 · Prisma 6 · Neon (Postgres).
Acuan lengkap: `technical-spec-pupr-kompetensi-nextjs.md`.

## Quick start

```bash
cp .env.example .env     # isi DATABASE_URL (pooled) dan DIRECT_URL (direct) dari dashboard Neon
npm install
npx prisma migrate dev --name init   # buat tabel di Neon branch dev
npm run dev                          # http://localhost:3000
```

Cek koneksi database: `GET /api/health` → `{"ok":true,"db":"up"}`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run lint` / `typecheck` / `test` | Kualitas kode |
| `npm run build` | Generate Prisma + build produksi |
| `npm run db:migrate` / `db:deploy` | Migrasi (dev / produksi) |

## Status fase

- [x] Fase 0 — Scaffold (config, Tailwind, Prisma+Neon, env tervalidasi, layout+sidebar, health check, CI)
- [x] Fase 1 — Auth, RBAC, onboarding (selesai, terverifikasi)
- [ ] Fase 2–8 — lihat dokumen teknis §11

## Keputusan yang ditahan

Skema `User/Role/Pegawai/Instansi/Jf/Jenjang` di `prisma/schema.prisma` memakai ASUMSI dokumen teknis §5
dan belum dicocokkan dengan DB CI4. Modul approval usulan dan CRUD batch/penyelenggara belum dirancang.

## Fase 1 — Auth, RBAC, onboarding

```bash
npm install
# isi .env: DATABASE_URL, DIRECT_URL, ID_SALT (>=16), AUTH_SECRET (>=16), SEED_ADMIN_USERNAME/PASSWORD
npx prisma migrate dev --name fase1_auth
npx prisma migrate dev --create-only --name fase1_partial_indexes   # lalu isi SQL dari prisma/manual/fase1-partial-indexes.sql
npx prisma migrate dev
npm run db:seed
npm run dev
```

Login lokal: `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`. Google: isi `AUTH_GOOGLE_ID/SECRET`
(redirect URI `http://localhost:3000/api/auth/callback/google`); untuk mencoba onboarding set `SEED_SAMPLE_DATA=true` sebelum seed.

Keterbatasan yang diketahui (ditutup di Fase 8): JWT berlaku 8 jam sehingga akun yang dinonaktifkan
baru efektif setelah token kedaluwarsa; CSP nonce belum aktif; rate limit memakai memori bila Upstash kosong.

## Fase 2 — Master & Jenis Kompetensi

CRUD Instansi, Jabatan Fungsional, Jenjang, Sertifikasi, dan Jenis Kompetensi (+ Sub Jenis). Tidak ada dependensi baru.

```bash
npx prisma migrate dev --name fase2_master
npx prisma migrate dev --create-only --name fase2_ci_unique_indexes
# tempel isi prisma/manual/fase2-ci-unique-indexes.sql ke migration.sql yang baru dibuat, lalu:
npx prisma migrate dev
npm run db:seed        # menambah permission baru
npm run typecheck && npm test
```

Tes integrasi (`tests/master-integration.test.ts`) menulis ke DB sungguhan dan dilewati bila
`TEST_DATABASE_URL` kosong. Gunakan branch Neon khusus tes (sudah dimigrasi), bukan DB kerja.

Catatan: hapus master adalah *hard delete* dengan guard 409 bila masih dipakai.
