-- Keunikan nama TIDAK peka huruf besar/kecil (J6). Tidak bisa dinyatakan di schema.prisma.
-- Setelah `npx prisma migrate dev --name fase2_master`:
--   npx prisma migrate dev --create-only --name fase2_ci_unique_indexes
--   (tempel SQL di bawah ke migration.sql yang dibuat) lalu: npx prisma migrate dev

CREATE UNIQUE INDEX "uq_jenis_nama_ci"       ON "JenisKompetensi" (lower("namaJenis"));
CREATE UNIQUE INDEX "uq_jenis_detail_nama_ci" ON "JenisKompetensiDetail" ("idJenis", lower("namaDetail"));
CREATE UNIQUE INDEX "uq_sertifikasi_nama_ci" ON "Sertifikasi" (lower("nama"));
CREATE UNIQUE INDEX "uq_jenjang_nama_ci"     ON "JenjangJabatan" (lower("nama"));

-- Satu penempatan aktif per pegawai (dari Fase 1) — lewati bila sudah dibuat:
-- CREATE UNIQUE INDEX "uq_penempatan_aktif" ON "PegawaiPenempatan" ("idPegawai") WHERE "tglSelesai" IS NULL;

-- CHECK periode/refreshment (dipakai Fase 5):
ALTER TABLE "Pelatihan" ADD CONSTRAINT ck_periode CHECK ("kPeriode" IS NULL OR "kPeriode" BETWEEN 2000 AND 2100);
ALTER TABLE "Pelatihan" ADD CONSTRAINT ck_refresh CHECK ("kRefreshment" IS NULL OR "kRefreshment" BETWEEN 1 AND 10);
