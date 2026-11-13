-- Dijalankan SETELAH migrasi model Fase 7a:
--   npx prisma migrate dev --name fase7a_batch_usulan
--   npx prisma migrate dev --create-only --name fase7a_checks   (tempel SQL ini ke migration.sql, lalu npx prisma migrate dev)

-- Satu usulan "hidup" per pegawai+pelatihan; setelah ditolak boleh mengajukan lagi (refreshment).
CREATE UNIQUE INDEX "uq_usulan_aktif" ON "PelatihanUsulan" ("idPegawai", "idPelatihan")
  WHERE "statusUsulan" IN ('mengusulkan', 'diajukan', 'disetujui');

ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT ck_usulan_status
  CHECK ("statusUsulan" IN ('mengusulkan', 'diajukan', 'disetujui', 'ditolak'));
ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT ck_usulan_jalur
  CHECK ("jalur" IS NULL OR "jalur" IN ('asn_pu', 'non_asn_pu'));
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT ck_batch_status
  CHECK ("statusBatch" IN ('draft', 'terjadwal', 'berjalan', 'selesai', 'dibatalkan'));
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT ck_batch_tanggal CHECK ("tanggalSelesai" >= "tanggalMulai");
CREATE UNIQUE INDEX "uq_penyelenggara_nama_ci" ON "Penyelenggara" (lower("nama"));
