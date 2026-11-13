CREATE UNIQUE INDEX "uq_penempatan_aktif"
  ON "PegawaiPenempatan" ("idPegawai")
  WHERE "tglSelesai" IS NULL;
