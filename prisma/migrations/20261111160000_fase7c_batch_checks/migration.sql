-- Fase 7c: CHECK & indeks batch/peserta/penyelenggara. Idempotent (aman bila migrasi Fase 7a-checks sudah/ belum dijalankan).
ALTER TABLE "PelatihanBatch" DROP CONSTRAINT IF EXISTS ck_batch_status;
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT ck_batch_status
  CHECK ("statusBatch" IN ('draft', 'terjadwal', 'berjalan', 'selesai', 'dibatalkan'));
ALTER TABLE "PelatihanBatch" DROP CONSTRAINT IF EXISTS ck_batch_tanggal;
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT ck_batch_tanggal CHECK ("tanggalSelesai" >= "tanggalMulai");
ALTER TABLE "PelatihanBatch" DROP CONSTRAINT IF EXISTS ck_batch_kapasitas;
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT ck_batch_kapasitas CHECK ("kapasitas" >= 0);

ALTER TABLE "PelatihanPesertaBatch" DROP CONSTRAINT IF EXISTS ck_peserta_kehadiran;
ALTER TABLE "PelatihanPesertaBatch" ADD CONSTRAINT ck_peserta_kehadiran
  CHECK ("statusKehadiran" IN ('terdaftar', 'hadir', 'selesai', 'tidak_hadir'));
ALTER TABLE "PelatihanPesertaBatch" DROP CONSTRAINT IF EXISTS ck_peserta_lulus;
ALTER TABLE "PelatihanPesertaBatch" ADD CONSTRAINT ck_peserta_lulus
  CHECK ("statusLulus" IS NULL OR "statusLulus" IN ('lulus', 'tidak_lulus'));

CREATE UNIQUE INDEX IF NOT EXISTS "uq_penyelenggara_nama_ci" ON "Penyelenggara" (lower("nama"));
