-- Keunikan nama program per (JF, sub jenis) TIDAK peka huruf besar/kecil.
-- npx prisma migrate dev --create-only --name fase4_ci_unique_index, tempel SQL ini, lalu npx prisma migrate dev
CREATE UNIQUE INDEX "uq_program_nama_ci" ON "ProgramBangkom" ("idJf", "idJenisDetail", lower("namaProgram"));
