-- CreateTable
CREATE TABLE "Golongan" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Golongan_pkey" PRIMARY KEY ("id")
);

-- Nama unik tanpa membedakan huruf besar-kecil (dijaga juga di aplikasi)
CREATE UNIQUE INDEX "uq_golongan_nama_ci" ON "Golongan" (lower("nama"));

-- CreateTable
CREATE TABLE "Pendidikan" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pendidikan_pkey" PRIMARY KEY ("id")
);

-- Nama unik tanpa membedakan huruf besar-kecil (dijaga juga di aplikasi)
CREATE UNIQUE INDEX "uq_pendidikan_nama_ci" ON "Pendidikan" (lower("nama"));

-- CreateTable
CREATE TABLE "StatusPegawai" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StatusPegawai_pkey" PRIMARY KEY ("id")
);

-- Nama unik tanpa membedakan huruf besar-kecil (dijaga juga di aplikasi)
CREATE UNIQUE INDEX "uq_statuspegawai_nama_ci" ON "StatusPegawai" (lower("nama"));

