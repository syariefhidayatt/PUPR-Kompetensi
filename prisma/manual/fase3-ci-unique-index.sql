-- Keunikan nama kompetensi per (JF, sub jenis) TIDAK peka huruf besar/kecil.
-- Jalankan: npx prisma migrate dev --create-only --name fase3_ci_unique_index, tempel SQL ini, lalu npx prisma migrate dev
CREATE UNIQUE INDEX "uq_kompetensi_nama_ci" ON "Kompetensi" ("idJf", "idJenisDetail", lower("namaKompetensi"));
