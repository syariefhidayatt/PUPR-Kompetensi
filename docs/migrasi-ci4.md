# Migrasi data CI4 → Neon

1. Pasang skema baru (tabel `UnitOrganisasi`, `UnitKerja`) — hanya di branch **dev**:
   `npx prisma migrate dev --name unit_master` lalu `npx prisma generate`
2. Cek isi dump tanpa DB: `npx tsx prisma/migrate-ci4.ts path/ke/dump.sql --parse-only`
3. Dry-run (jalan penuh di DB lalu rollback; tampilkan jumlah baru/dipakai-ulang/dilewati):
   `npx tsx prisma/migrate-ci4.ts path/ke/dump.sql`
4. Simpan permanen: tambahkan `--apply`.
5. Jalankan tes: `npm test` (ada `tests/ci4-parse.test.ts`).

Aman diulang (kunci alami: nama, NIP). Baris soft-deleted CI4 tidak diimpor.
Diimpor juga: penyelenggara, batch, usulan, peserta batch (tahap persetujuan CI4 tidak diimpor; lampiran tidak diimpor). Belum: users/role, sertifikat pegawai, log.
Asumsi yang perlu dikonfirmasi: agama 1=Islam,2=Kristen,3=Katolik,4=Hindu,5=Buddha,6=Konghucu,7=Lainnya
(ubah di `AGAMA` pada `src/server/migrate/ci4-parse.ts`); jenis_kelamin 1=L, 2=P.
Pegawai hasil impor belum punya akun (`idUser` kosong).
