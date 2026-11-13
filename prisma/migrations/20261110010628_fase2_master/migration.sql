/*
  Warnings:

  - A unique constraint covering the columns `[urutan]` on the table `JenjangJabatan` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Sertifikasi" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Sertifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JenisKompetensi" (
    "id" BIGSERIAL NOT NULL,
    "namaJenis" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JenisKompetensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JenisKompetensiDetail" (
    "id" BIGSERIAL NOT NULL,
    "idJenis" BIGINT NOT NULL,
    "namaDetail" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "JenisKompetensiDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kompetensi" (
    "id" BIGSERIAL NOT NULL,
    "idJf" BIGINT NOT NULL,
    "idJenisDetail" BIGINT NOT NULL,
    "namaKompetensi" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Kompetensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBangkom" (
    "id" BIGSERIAL NOT NULL,
    "idJf" BIGINT NOT NULL,
    "idJenisDetail" BIGINT NOT NULL,
    "namaProgram" TEXT NOT NULL,
    "deskripsi" TEXT,
    "kategori" TEXT,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramBangkom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pelatihan" (
    "id" BIGSERIAL NOT NULL,
    "idProgram" BIGINT NOT NULL,
    "namaPelatihan" VARCHAR(500) NOT NULL,
    "deskripsi" TEXT,
    "isPeriode" BOOLEAN NOT NULL DEFAULT false,
    "kPeriode" SMALLINT,
    "isRefreshment" BOOLEAN NOT NULL DEFAULT false,
    "kRefreshment" SMALLINT,
    "isSertifikat" BOOLEAN NOT NULL DEFAULT false,
    "jenisPelatihan" TEXT,
    "kategoriPelatihan" TEXT,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pelatihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PelatihanJenjang" (
    "idPelatihan" BIGINT NOT NULL,
    "idJenjang" BIGINT NOT NULL,

    CONSTRAINT "PelatihanJenjang_pkey" PRIMARY KEY ("idPelatihan","idJenjang")
);

-- CreateTable
CREATE TABLE "PelatihanKompetensi" (
    "idPelatihan" BIGINT NOT NULL,
    "idKompetensi" BIGINT NOT NULL,

    CONSTRAINT "PelatihanKompetensi_pkey" PRIMARY KEY ("idPelatihan","idKompetensi")
);

-- CreateTable
CREATE TABLE "PelatihanSertifikasi" (
    "idPelatihan" BIGINT NOT NULL,
    "idSertifikasi" BIGINT NOT NULL,

    CONSTRAINT "PelatihanSertifikasi_pkey" PRIMARY KEY ("idPelatihan","idSertifikasi")
);

-- CreateIndex
CREATE UNIQUE INDEX "JenisKompetensi_namaJenis_key" ON "JenisKompetensi"("namaJenis");

-- CreateIndex
CREATE UNIQUE INDEX "JenisKompetensiDetail_idJenis_namaDetail_key" ON "JenisKompetensiDetail"("idJenis", "namaDetail");

-- CreateIndex
CREATE UNIQUE INDEX "Kompetensi_idJf_idJenisDetail_namaKompetensi_key" ON "Kompetensi"("idJf", "idJenisDetail", "namaKompetensi");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramBangkom_idJf_idJenisDetail_namaProgram_key" ON "ProgramBangkom"("idJf", "idJenisDetail", "namaProgram");

-- CreateIndex
CREATE UNIQUE INDEX "JenjangJabatan_urutan_key" ON "JenjangJabatan"("urutan");

-- AddForeignKey
ALTER TABLE "JenisKompetensiDetail" ADD CONSTRAINT "JenisKompetensiDetail_idJenis_fkey" FOREIGN KEY ("idJenis") REFERENCES "JenisKompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kompetensi" ADD CONSTRAINT "Kompetensi_idJf_fkey" FOREIGN KEY ("idJf") REFERENCES "Jf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kompetensi" ADD CONSTRAINT "Kompetensi_idJenisDetail_fkey" FOREIGN KEY ("idJenisDetail") REFERENCES "JenisKompetensiDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBangkom" ADD CONSTRAINT "ProgramBangkom_idJf_fkey" FOREIGN KEY ("idJf") REFERENCES "Jf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBangkom" ADD CONSTRAINT "ProgramBangkom_idJenisDetail_fkey" FOREIGN KEY ("idJenisDetail") REFERENCES "JenisKompetensiDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pelatihan" ADD CONSTRAINT "Pelatihan_idProgram_fkey" FOREIGN KEY ("idProgram") REFERENCES "ProgramBangkom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanJenjang" ADD CONSTRAINT "PelatihanJenjang_idPelatihan_fkey" FOREIGN KEY ("idPelatihan") REFERENCES "Pelatihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanJenjang" ADD CONSTRAINT "PelatihanJenjang_idJenjang_fkey" FOREIGN KEY ("idJenjang") REFERENCES "JenjangJabatan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanKompetensi" ADD CONSTRAINT "PelatihanKompetensi_idPelatihan_fkey" FOREIGN KEY ("idPelatihan") REFERENCES "Pelatihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanKompetensi" ADD CONSTRAINT "PelatihanKompetensi_idKompetensi_fkey" FOREIGN KEY ("idKompetensi") REFERENCES "Kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanSertifikasi" ADD CONSTRAINT "PelatihanSertifikasi_idPelatihan_fkey" FOREIGN KEY ("idPelatihan") REFERENCES "Pelatihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanSertifikasi" ADD CONSTRAINT "PelatihanSertifikasi_idSertifikasi_fkey" FOREIGN KEY ("idSertifikasi") REFERENCES "Sertifikasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
