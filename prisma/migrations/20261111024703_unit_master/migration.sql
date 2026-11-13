-- CreateTable
CREATE TABLE "UnitOrganisasi" (
    "id" BIGSERIAL NOT NULL,
    "nama" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOrganisasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitKerja" (
    "id" BIGSERIAL NOT NULL,
    "nama" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitKerja_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idUnitOrganisasi_fkey" FOREIGN KEY ("idUnitOrganisasi") REFERENCES "UnitOrganisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PegawaiPenempatan" ADD CONSTRAINT "PegawaiPenempatan_idUnitKerja_fkey" FOREIGN KEY ("idUnitKerja") REFERENCES "UnitKerja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
