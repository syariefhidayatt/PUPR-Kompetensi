-- SQL yang tidak bisa dinyatakan di schema.prisma. Tempel ke migration kosong:
--   npx prisma migrate dev --create-only --name fase1_partial_indexes
--   (isi file migration.sql yang dibuat dengan SQL di bawah, lalu) npx prisma migrate dev

-- Satu penempatan aktif per pegawai
CREATE UNIQUE INDEX "uq_penempatan_aktif"
  ON "PegawaiPenempatan" ("idPegawai")
  WHERE "tglSelesai" IS NULL;
