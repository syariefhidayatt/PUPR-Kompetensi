-- CreateTable
CREATE TABLE "Penyelenggara" (
    "id" BIGSERIAL NOT NULL,
    "nama" VARCHAR(200) NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Penyelenggara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PelatihanBatch" (
    "id" BIGSERIAL NOT NULL,
    "idPelatihan" BIGINT NOT NULL,
    "idPenyelenggara" BIGINT,
    "tahunPelaksanaan" SMALLINT NOT NULL,
    "angkatan" VARCHAR(20) NOT NULL DEFAULT 'I',
    "tanggalMulai" DATE NOT NULL,
    "tanggalSelesai" DATE NOT NULL,
    "kapasitas" INTEGER NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "statusBatch" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelatihanBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PelatihanPesertaBatch" (
    "id" BIGSERIAL NOT NULL,
    "idBatch" BIGINT NOT NULL,
    "idPegawai" BIGINT NOT NULL,
    "idUsulan" BIGINT,
    "statusKehadiran" VARCHAR(20) NOT NULL DEFAULT 'terdaftar',
    "nilaiAkhir" DECIMAL(5,2),
    "statusLulus" VARCHAR(20),
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "noSertifikat" VARCHAR(100),
    "tanggalLulus" DATE,
    "keterangan" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelatihanPesertaBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PelatihanUsulan" (
    "id" BIGSERIAL NOT NULL,
    "idPegawai" BIGINT NOT NULL,
    "idPelatihan" BIGINT NOT NULL,
    "tanggalUsulan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusUsulan" VARCHAR(20) NOT NULL DEFAULT 'mengusulkan',
    "diusulkanOleh" VARCHAR(150) NOT NULL,
    "diusulkanOlehRole" VARCHAR(30),
    "alasanUsulan" TEXT,
    "alasanPenolakan" TEXT,
    "lampiranPath" VARCHAR(255),
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "jalur" VARCHAR(20),
    "tahapSaatIni" VARCHAR(30),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelatihanUsulan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Penyelenggara_nama_key" ON "Penyelenggara"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "PelatihanBatch_idPelatihan_tahunPelaksanaan_angkatan_key" ON "PelatihanBatch"("idPelatihan", "tahunPelaksanaan", "angkatan");

-- CreateIndex
CREATE UNIQUE INDEX "PelatihanPesertaBatch_idBatch_idPegawai_key" ON "PelatihanPesertaBatch"("idBatch", "idPegawai");

-- CreateIndex
CREATE INDEX "PelatihanUsulan_idPegawai_idPelatihan_idx" ON "PelatihanUsulan"("idPegawai", "idPelatihan");

-- AddForeignKey
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT "PelatihanBatch_idPelatihan_fkey" FOREIGN KEY ("idPelatihan") REFERENCES "Pelatihan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanBatch" ADD CONSTRAINT "PelatihanBatch_idPenyelenggara_fkey" FOREIGN KEY ("idPenyelenggara") REFERENCES "Penyelenggara"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanPesertaBatch" ADD CONSTRAINT "PelatihanPesertaBatch_idBatch_fkey" FOREIGN KEY ("idBatch") REFERENCES "PelatihanBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanPesertaBatch" ADD CONSTRAINT "PelatihanPesertaBatch_idPegawai_fkey" FOREIGN KEY ("idPegawai") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanPesertaBatch" ADD CONSTRAINT "PelatihanPesertaBatch_idUsulan_fkey" FOREIGN KEY ("idUsulan") REFERENCES "PelatihanUsulan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT "PelatihanUsulan_idPegawai_fkey" FOREIGN KEY ("idPegawai") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT "PelatihanUsulan_idPelatihan_fkey" FOREIGN KEY ("idPelatihan") REFERENCES "Pelatihan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
