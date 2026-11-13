-- CreateEnum
CREATE TYPE "RumpunJabatan" AS ENUM ('KEAHLIAN', 'KETERAMPILAN');

-- DropIndex
DROP INDEX "JenjangJabatan_urutan_idx";

-- AlterTable
ALTER TABLE "JenjangJabatan" ADD COLUMN     "rumpun" "RumpunJabatan" NOT NULL DEFAULT 'KEAHLIAN';

-- CreateIndex
CREATE INDEX "JenjangJabatan_rumpun_urutan_idx" ON "JenjangJabatan"("rumpun", "urutan");
