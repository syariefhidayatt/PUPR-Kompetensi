-- DropIndex
DROP INDEX "JenjangJabatan_urutan_key";

-- CreateIndex
CREATE INDEX "JenjangJabatan_urutan_idx" ON "JenjangJabatan"("urutan");
