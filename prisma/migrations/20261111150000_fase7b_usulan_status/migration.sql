-- Fase 7b: status usulan bertambah 'dibatalkan' (ada di CI4). Idempotent: aman walau CHECK Fase 7a belum pernah dipasang.
ALTER TABLE "PelatihanUsulan" DROP CONSTRAINT IF EXISTS ck_usulan_status;
ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT ck_usulan_status
  CHECK ("statusUsulan" IN ('mengusulkan', 'diajukan', 'disetujui', 'ditolak', 'dibatalkan'));

ALTER TABLE "PelatihanUsulan" DROP CONSTRAINT IF EXISTS ck_usulan_jalur;
ALTER TABLE "PelatihanUsulan" ADD CONSTRAINT ck_usulan_jalur
  CHECK ("jalur" IS NULL OR "jalur" IN ('asn_pu', 'non_asn_pu'));

-- Satu usulan "hidup" per pegawai+pelatihan (dibatalkan/ditolak tidak dihitung).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_usulan_aktif" ON "PelatihanUsulan" ("idPegawai", "idPelatihan")
  WHERE "statusUsulan" IN ('mengusulkan', 'diajukan', 'disetujui');
