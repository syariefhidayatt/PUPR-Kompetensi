/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UnitKerja` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UnitKerja` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UnitOrganisasi` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UnitOrganisasi` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idInstansi,kode]` on the table `UnitKerja` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idInstansi,kode]` on the table `UnitOrganisasi` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idInstansi` to the `UnitKerja` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kode` to the `UnitKerja` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idInstansi` to the `UnitOrganisasi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kode` to the `UnitOrganisasi` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UnitKerja" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "idInstansi" BIGINT NOT NULL,
ADD COLUMN     "idUnitOrganisasi" BIGINT,
ADD COLUMN     "kode" TEXT NOT NULL,
ADD COLUMN     "statusAktif" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "nama" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "UnitOrganisasi" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "idInstansi" BIGINT NOT NULL,
ADD COLUMN     "kode" TEXT NOT NULL,
ADD COLUMN     "statusAktif" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "nama" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UnitKerja_idInstansi_kode_key" ON "UnitKerja"("idInstansi", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOrganisasi_idInstansi_kode_key" ON "UnitOrganisasi"("idInstansi", "kode");

-- AddForeignKey
ALTER TABLE "UnitOrganisasi" ADD CONSTRAINT "UnitOrganisasi_idInstansi_fkey" FOREIGN KEY ("idInstansi") REFERENCES "Instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitKerja" ADD CONSTRAINT "UnitKerja_idInstansi_fkey" FOREIGN KEY ("idInstansi") REFERENCES "Instansi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitKerja" ADD CONSTRAINT "UnitKerja_idUnitOrganisasi_fkey" FOREIGN KEY ("idUnitOrganisasi") REFERENCES "UnitOrganisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
