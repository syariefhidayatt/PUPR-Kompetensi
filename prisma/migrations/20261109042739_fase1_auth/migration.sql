-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "idInstansi" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" BIGSERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" BIGSERIAL NOT NULL,
    "kode" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" BIGINT NOT NULL,
    "permissionId" BIGINT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Instansi" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" INTEGER NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Instansi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jf" (
    "id" BIGSERIAL NOT NULL,
    "idInstansi" BIGINT NOT NULL,
    "kodeJf" TEXT,
    "namaJf" TEXT NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Jf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JenjangJabatan" (
    "id" BIGSERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "JenjangJabatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pegawai" (
    "id" BIGSERIAL NOT NULL,
    "idUser" BIGINT,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT,
    "hp" TEXT,
    "telp" TEXT,
    "tempatLahir" TEXT,
    "tglLahir" DATE,
    "jenisKelamin" TEXT,
    "agama" TEXT,
    "alamat" TEXT,
    "pendidikan" TEXT,
    "jurusan" TEXT,
    "golongan" TEXT,
    "tmt" DATE,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pegawai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PegawaiPenempatan" (
    "id" BIGSERIAL NOT NULL,
    "idPegawai" BIGINT NOT NULL,
    "idInstansi" BIGINT NOT NULL,
    "idUnitOrganisasi" BIGINT,
    "idUnitKerja" BIGINT,
    "idJf" BIGINT,
    "idJenjang" BIGINT,
    "statusPegawai" TEXT,
    "tglMulai" DATE NOT NULL,
    "tglSelesai" DATE,
    "noSk" TEXT,
    "keterangan" TEXT,

    CONSTRAINT "PegawaiPenempatan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_kode_key" ON "Role"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_kode_key" ON "Permission"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_idUser_key" ON "Pegawai"("idUser");

-- CreateIndex
CREATE UNIQUE INDEX "Pegawai_nip_key" ON "Pegawai"("nip");

-- CreateIndex
CREATE INDEX "PegawaiPenempatan_idPegawai_tglSelesai_idx" ON "PegawaiPenempatan"("idPegawai", "tglSelesai");

-- CreateIndex
CREATE INDEX "AuditLog_aksi_createdAt_idx" ON "AuditLog"("aksi", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_idInstansi_fkey" FOREIGN KEY ("idInstansi") REFERENCES "Instansi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jf" ADD CONSTRAINT "Jf_idInstansi_fkey" FOREIGN KEY ("idInstansi") REFERENCES "Instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pegawai" ADD CONSTRAINT "Pegawai_idUser_fkey" FOREIGN KEY ("idUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idPegawai_fkey" FOREIGN KEY ("idPegawai") REFERENCES "Pegawai"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idInstansi_fkey" FOREIGN KEY ("idInstansi") REFERENCES "Instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idJf_fkey" FOREIGN KEY ("idJf") REFERENCES "Jf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idJenjang_fkey" FOREIGN KEY ("idJenjang") REFERENCES "JenjangJabatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
