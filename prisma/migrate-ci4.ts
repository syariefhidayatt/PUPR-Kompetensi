/**
 * Migrasi data CI4 → Neon/Prisma.
 *
 *   npx tsx prisma/migrate-ci4.ts <dump.sql>                 # dry-run: jalan penuh di DB lalu ROLLBACK
 *   npx tsx prisma/migrate-ci4.ts <dump.sql> --apply         # tulis permanen
 *   npx tsx prisma/migrate-ci4.ts <dump.sql> --parse-only    # hanya baca dump (tanpa DB)
 *
 * Aman diulang: tiap baris dicocokkan dengan kunci alami (nama/NIP, tanpa beda huruf besar-kecil);
 * yang sudah ada dipakai ulang, yang belum dibuat. ID CI4 tidak dipertahankan (dipetakan ke ID baru).
 * Baris soft-deleted CI4 (deleted_at terisi) tidak diimpor. Tidak mencetak data pribadi.
 *
 * Belum diimpor: users/role CI4, tahap usulan (persetujuan kini langsung oleh admin), lampiran, sertifikat pegawai, log.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { agama, aktif, dateOnly, jenisKelamin, parseDump, rumpunDariNama, stripDeleted, timestamp } from "../src/server/migrate/ci4-parse";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const PARSE_ONLY = args.includes("--parse-only");
if (!file) {
  console.error("Pemakaian: npx tsx prisma/migrate-ci4.ts <dump.sql> [--apply | --parse-only]");
  process.exit(1);
}

const sqlText = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const { rows } = parseDump(sqlText);
for (const wajib of ["m_instansi", "m_jf", "pegawai", "pegawai_penempatan"]) {
  if (!rows[wajib]?.length) {
    const copy = /^COPY public\./m.test(sqlText);
    console.error(
      `Dump tidak berisi baris untuk tabel "${wajib}".` +
        (copy ? " File ini memakai format COPY; buat ulang dump dengan: pg_dump --inserts --no-owner ..." : " Pastikan file dump yang benar (berisi INSERT INTO public...)."),
    );
    process.exit(1);
  }
}
const T = (name: string) => rows[name] ?? [];
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const k = (...p: (string | bigint | number)[]) => p.map((x) => String(x).toLowerCase()).join("|");

const report: Record<string, { baru: number; dipakaiUlang: number; dilewati: number }> = {};
const warn: string[] = [];
function stat(name: string) {
  return (report[name] ??= { baru: 0, dipakaiUlang: 0, dilewati: 0 });
}

class DryRun extends Error {}

async function run(tx: Prisma.TransactionClient) {
  // ---------- Instansi ----------
  const instansiMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.instansi.findMany()).map((r) => [k(r.nama), r.id]));
    for (const r of T("m_instansi")) {
      const s = stat("instansi");
      if (!aktif(r)) { s.dilewati++; continue; }
      const nama = str(r.nama_instansi)!;
      let id = ada.get(k(nama));
      if (id === undefined) {
        id = (await tx.instansi.create({ data: { nama, jenis: Number(r.jenis), statusAktif: r.status_aktif === true } })).id;
        ada.set(k(nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      instansiMap.set(r.id as number, id);
    }
  }

  // ---------- JF ----------
  const jfMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.jf.findMany()).map((r) => [k(r.idInstansi, r.namaJf), r.id]));
    for (const r of T("m_jf")) {
      const s = stat("jf");
      const idInstansi = instansiMap.get(r.id_instansi as number);
      if (!aktif(r) || idInstansi === undefined) { s.dilewati++; continue; }
      const namaJf = str(r.nama_jf)!;
      let id = ada.get(k(idInstansi, namaJf));
      if (id === undefined) {
        id = (await tx.jf.create({ data: { idInstansi, kodeJf: str(r.kode_jf), namaJf, statusAktif: r.status_aktif === true } })).id;
        ada.set(k(idInstansi, namaJf), id);
        s.baru++;
      } else s.dipakaiUlang++;
      jfMap.set(r.id as number, id);
    }
  }

  // ---------- Jenjang (rumpun diisi dari nama; urutan dari CI4) ----------
  const jenjangMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.jenjangJabatan.findMany()).map((r) => [k(r.nama), r.id]));
    for (const r of T("m_jenjang_jabatan")) {
      const s = stat("jenjang");
      if (!aktif(r)) { s.dilewati++; continue; }
      const nama = str(r.nama_jenjang)!;
      let id = ada.get(k(nama));
      if (id === undefined) {
        const rumpun = rumpunDariNama(nama);
        if (!rumpun) warn.push(`Jenjang "${nama}": rumpun tidak dikenali → KEAHLIAN (periksa manual)`);
        id = (await tx.jenjangJabatan.create({ data: { nama, rumpun: rumpun ?? "KEAHLIAN", urutan: Number(r.urutan), statusAktif: r.status_aktif === true } })).id;
        ada.set(k(nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      jenjangMap.set(r.id as number, id);
    }
  }

  // ---------- Sertifikasi ----------
  const sertMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.sertifikasi.findMany()).map((r) => [k(r.nama), r.id]));
    for (const r of T("m_sertifikasi")) {
      const s = stat("sertifikasi");
      if (!aktif(r)) { s.dilewati++; continue; }
      const nama = str(r.nama_sertifikasi)!;
      let id = ada.get(k(nama));
      if (id === undefined) {
        id = (await tx.sertifikasi.create({ data: { nama, statusAktif: r.status_aktif === true } })).id;
        ada.set(k(nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      sertMap.set(r.id as number, id);
    }
  }

  // ---------- Jenis kompetensi + detail ----------
  const jenisMap = new Map<number, bigint>();
  const detailMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.jenisKompetensi.findMany()).map((r) => [k(r.namaJenis), r.id]));
    for (const r of T("m_jenis_kompetensi")) {
      const s = stat("jenis kompetensi");
      if (!aktif(r)) { s.dilewati++; continue; }
      const nama = str(r.nama_jenis)!;
      let id = ada.get(k(nama));
      if (id === undefined) {
        id = (await tx.jenisKompetensi.create({ data: { namaJenis: nama, statusAktif: r.status_aktif === true, createdBy: str(r.created_by) } })).id;
        ada.set(k(nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      jenisMap.set(r.id as number, id);
    }
    const adaD = new Map((await tx.jenisKompetensiDetail.findMany()).map((r) => [k(r.idJenis, r.namaDetail), r.id]));
    for (const r of T("m_jenis_kompetensi_detail")) {
      const s = stat("jenis kompetensi detail");
      const idJenis = jenisMap.get(r.id_jenis as number);
      if (idJenis === undefined) { s.dilewati++; continue; }
      const nama = str(r.nama_detail)!;
      let id = adaD.get(k(idJenis, nama));
      if (id === undefined) {
        id = (await tx.jenisKompetensiDetail.create({ data: { idJenis, namaDetail: nama, statusAktif: r.status_aktif === true } })).id;
        adaD.set(k(idJenis, nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      detailMap.set(r.id as number, id);
    }
  }

  // ---------- Kompetensi ----------
  const kompMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.kompetensi.findMany()).map((r) => [k(r.idJf, r.idJenisDetail, r.namaKompetensi), r.id]));
    for (const r of T("m_kompetensi")) {
      const s = stat("kompetensi");
      const idJf = jfMap.get(r.id_jf as number);
      const idJenisDetail = detailMap.get(r.id_jenis_detail as number);
      if (!aktif(r) || idJf === undefined || idJenisDetail === undefined) { s.dilewati++; continue; }
      const namaKompetensi = str(r.nama_kompetensi)!;
      let id = ada.get(k(idJf, idJenisDetail, namaKompetensi));
      if (id === undefined) {
        id = (await tx.kompetensi.create({ data: { idJf, idJenisDetail, namaKompetensi, statusAktif: r.status_aktif === true, createdBy: str(r.created_by) } })).id;
        ada.set(k(idJf, idJenisDetail, namaKompetensi), id);
        s.baru++;
      } else s.dipakaiUlang++;
      kompMap.set(r.id as number, id);
    }
  }

  // ---------- Program ----------
  const programMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.programBangkom.findMany()).map((r) => [k(r.idJf, r.idJenisDetail, r.namaProgram), r.id]));
    for (const r of T("program_bangkom")) {
      const s = stat("program");
      const idJf = jfMap.get(r.id_jf as number);
      const idJenisDetail = detailMap.get(r.id_jenis_detail as number);
      if (!aktif(r) || idJf === undefined || idJenisDetail === undefined) { s.dilewati++; continue; }
      const namaProgram = str(r.nama_program)!;
      let id = ada.get(k(idJf, idJenisDetail, namaProgram));
      if (id === undefined) {
        id = (await tx.programBangkom.create({ data: { idJf, idJenisDetail, namaProgram, deskripsi: str(r.deskripsi), kategori: str(r.kategori), statusAktif: r.status_aktif === true, createdBy: str(r.created_by) } })).id;
        ada.set(k(idJf, idJenisDetail, namaProgram), id);
        s.baru++;
      } else s.dipakaiUlang++;
      programMap.set(r.id as number, id);
    }
  }

  // ---------- Pelatihan + prasyarat ----------
  const pelMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.pelatihan.findMany()).map((r) => [k(r.idProgram, r.namaPelatihan), r.id]));
    for (const r of T("pelatihan")) {
      const s = stat("pelatihan");
      const idProgram = programMap.get(r.id_program as number);
      if (!aktif(r) || idProgram === undefined) { s.dilewati++; continue; }
      const namaPelatihan = str(r.nama_pelatihan)!;
      let id = ada.get(k(idProgram, namaPelatihan));
      if (id === undefined) {
        id = (
          await tx.pelatihan.create({
            data: {
              idProgram, namaPelatihan, deskripsi: str(r.deskripsi),
              isPeriode: r.is_periode === true, kPeriode: typeof r.k_periode === "number" ? r.k_periode : null,
              isRefreshment: r.is_refreshment === true, kRefreshment: typeof r.k_refreshment === "number" ? r.k_refreshment : null,
              isSertifikat: r.is_sertifikat === true, jenisPelatihan: str(r.jenis_pelatihan), kategoriPelatihan: str(r.kategori_pelatihan),
              statusAktif: r.status_aktif === true, createdBy: str(r.created_by),
            },
          })
        ).id;
        ada.set(k(idProgram, namaPelatihan), id);
        s.baru++;
      } else s.dipakaiUlang++;
      pelMap.set(r.id as number, id);
    }
    const pivot = async (tabel: string, kol: string, map: Map<number, bigint>, create: (data: { idPelatihan: bigint; ref: bigint }[]) => Promise<{ count: number }>) => {
      const data = T(tabel).flatMap((r) => {
        const idPelatihan = pelMap.get(r.id_pelatihan as number);
        const ref = map.get(r[kol] as number);
        return idPelatihan !== undefined && ref !== undefined ? [{ idPelatihan, ref }] : [];
      });
      const s = stat(tabel);
      const { count } = await create(data);
      s.baru += count;
      s.dipakaiUlang += data.length - count;
      s.dilewati += T(tabel).length - data.length;
    };
    await pivot("pelatihan_jenjang", "id_jenjang", jenjangMap, (d) => tx.pelatihanJenjang.createMany({ data: d.map((x) => ({ idPelatihan: x.idPelatihan, idJenjang: x.ref })), skipDuplicates: true }));
    await pivot("pelatihan_kompetensi", "id_kompetensi", kompMap, (d) => tx.pelatihanKompetensi.createMany({ data: d.map((x) => ({ idPelatihan: x.idPelatihan, idKompetensi: x.ref })), skipDuplicates: true }));
    await pivot("pelatihan_sertifikasi", "id_sertifikasi", sertMap, (d) => tx.pelatihanSertifikasi.createMany({ data: d.map((x) => ({ idPelatihan: x.idPelatihan, idSertifikasi: x.ref })), skipDuplicates: true }));
  }

  // ---------- Unit organisasi & unit kerja ----------
  const uoMap = new Map<number, bigint>();
  const ukMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.unitOrganisasi.findMany()).map((r) => [k(r.idInstansi, r.kode), r.id]));
    for (const r of T("m_unit_organisasi")) {
      const s = stat("unit organisasi");
      const idInstansi = instansiMap.get(r.id_instansi as number);
      if (!aktif(r) || idInstansi === undefined) { s.dilewati++; continue; }
      const kode = str(r.kode_unit)!;
      let id = ada.get(k(idInstansi, kode));
      if (id === undefined) {
        id = (await tx.unitOrganisasi.create({ data: { idInstansi, kode, nama: str(r.nama_unit)!, statusAktif: r.status_aktif === true } })).id;
        ada.set(k(idInstansi, kode), id);
        s.baru++;
      } else s.dipakaiUlang++;
      uoMap.set(r.id as number, id);
    }
    const adaK = new Map((await tx.unitKerja.findMany()).map((r) => [k(r.idInstansi, r.kode), r.id]));
    for (const r of T("m_unit_kerja")) {
      const s = stat("unit kerja");
      const idInstansi = instansiMap.get(r.id_instansi as number);
      if (!aktif(r) || idInstansi === undefined) { s.dilewati++; continue; }
      const kode = str(r.kode_unit_kerja)!;
      let id = adaK.get(k(idInstansi, kode));
      if (id === undefined) {
        id = (await tx.unitKerja.create({ data: { idInstansi, idUnitOrganisasi: uoMap.get(r.id_unit_organisasi as number) ?? null, kode, nama: str(r.nama_unit_kerja)!, statusAktif: r.status_aktif === true } })).id;
        adaK.set(k(idInstansi, kode), id);
        s.baru++;
      } else s.dipakaiUlang++;
      ukMap.set(r.id as number, id);
    }
  }

  // ---------- Pegawai + penempatan ----------
  const nama = (tabel: string, kol: string) => new Map(T(tabel).map((r) => [r.id as number, stripDeleted(String(r[kol] ?? ""))]));
  const golongan = nama("m_golongan", "nama_golongan");
  const pendidikan = nama("m_pendidikan", "nama_pendidikan");
  const statusPeg = nama("m_status_pegawai", "nama_status");

  // Referensi kepegawaian → tabel master (nama unik tanpa beda huruf; baris soft-deleted masuk sebagai nonaktif).
  const refMaster = async (tabel: string, kol: string, label: string, repo: { findMany: () => Promise<{ nama: string }[]>; create: (a: { data: { nama: string; statusAktif: boolean } }) => Promise<unknown> }) => {
    const ada = new Set((await repo.findMany()).map((r) => r.nama.toLowerCase()));
    const s = stat(label);
    for (const r of T(tabel)) {
      const n = stripDeleted(String(r[kol] ?? ""));
      if (!n) { s.dilewati++; continue; }
      if (ada.has(n.toLowerCase())) { s.dipakaiUlang++; continue; }
      await repo.create({ data: { nama: n, statusAktif: aktif(r) && r.status_aktif !== false } });
      ada.add(n.toLowerCase());
      s.baru++;
    }
  };
  await refMaster("m_golongan", "nama_golongan", "golongan", tx.golongan);
  await refMaster("m_pendidikan", "nama_pendidikan", "pendidikan", tx.pendidikan);
  await refMaster("m_status_pegawai", "nama_status", "status pegawai", tx.statusPegawai);

  const pegMap = new Map<number, bigint>();
  const baruPeg = new Set<number>();
  {
    const ada = new Map((await tx.pegawai.findMany({ select: { id: true, nip: true } })).map((r) => [r.nip, r.id]));
    for (const r of T("pegawai")) {
      const s = stat("pegawai");
      const nip = str(r.nip);
      if (!aktif(r) || !nip) { s.dilewati++; continue; }
      let id = ada.get(nip);
      if (id === undefined) {
        id = (
          await tx.pegawai.create({
            data: {
              nip, nama: str(r.nama)!, email: str(r.email), hp: str(r.hp), telp: str(r.telp),
              tempatLahir: str(r.tempat_lahir), tglLahir: dateOnly(r.tgl_lahir), jenisKelamin: jenisKelamin(r.jenis_kelamin),
              agama: agama(r.agama), alamat: str(r.alamat), jurusan: str(r.jurusan), tmt: dateOnly(r.tmt),
              pendidikan: pendidikan.get(r.id_pendidikan as number) || null, golongan: golongan.get(r.id_golongan as number) || null,
              createdBy: str(r.created_by) ?? "migrasi-ci4",
            },
          })
        ).id;
        ada.set(nip, id);
        baruPeg.add(r.id as number);
        s.baru++;
      } else s.dipakaiUlang++;
      pegMap.set(r.id as number, id);
    }
    // Penempatan hanya untuk pegawai BARU (pegawai yang sudah ada tidak disentuh → aman diulang).
    const data: Prisma.PegawaiPenempatanCreateManyInput[] = [];
    const s = stat("penempatan");
    for (const r of T("pegawai_penempatan")) {
      const idPegawai = pegMap.get(r.id_pegawai as number);
      const idInstansi = instansiMap.get(r.id_instansi as number);
      const mulai = dateOnly(r.tgl_mulai);
      if (idPegawai === undefined || !baruPeg.has(r.id_pegawai as number)) { s.dilewati++; continue; }
      if (idInstansi === undefined || !mulai) { warn.push(`Penempatan CI4 #${String(r.id)} dilewati: instansi/tgl_mulai tidak valid`); s.dilewati++; continue; }
      data.push({
        idPegawai, idInstansi, tglMulai: mulai, tglSelesai: dateOnly(r.tgl_selesai),
        idUnitOrganisasi: uoMap.get(r.id_unit_organisasi as number) ?? null, idUnitKerja: ukMap.get(r.id_unit_kerja as number) ?? null,
        idJf: jfMap.get(r.id_jf as number) ?? null, idJenjang: jenjangMap.get(r.id_jenjang as number) ?? null,
        statusPegawai: statusPeg.get(r.id_status_pegawai as number) || null, noSk: str(r.no_sk), keterangan: str(r.keterangan),
      });
    }
    s.baru += (await tx.pegawaiPenempatan.createMany({ data })).count;
  }
  // ---------- Penyelenggara, batch, usulan, peserta ----------
  const penyMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.penyelenggara.findMany()).map((r) => [k(r.nama), r.id]));
    for (const r of T("m_penyelenggara")) {
      const s = stat("penyelenggara");
      if (!aktif(r)) { s.dilewati++; continue; }
      const nama = str(r.nama_penyelenggara)!;
      let id = ada.get(k(nama));
      if (id === undefined) {
        id = (await tx.penyelenggara.create({ data: { nama, statusAktif: r.status_aktif === true, createdBy: str(r.created_by) } })).id;
        ada.set(k(nama), id);
        s.baru++;
      } else s.dipakaiUlang++;
      penyMap.set(r.id as number, id);
    }
  }

  const batchMap = new Map<number, bigint>();
  {
    const ada = new Map((await tx.pelatihanBatch.findMany()).map((r) => [k(r.idPelatihan, r.tahunPelaksanaan, r.angkatan), r.id]));
    for (const r of T("pelatihan_batch")) {
      const s = stat("batch");
      const idPelatihan = pelMap.get(r.id_pelatihan as number);
      const mulai = dateOnly(r.tanggal_mulai);
      const selesai = dateOnly(r.tanggal_selesai);
      if (idPelatihan === undefined || !mulai || !selesai) { s.dilewati++; continue; }
      const tahun = Number(r.tahun_pelaksanaan);
      const angkatan = str(r.angkatan) ?? "I";
      let id = ada.get(k(idPelatihan, tahun, angkatan));
      if (id === undefined) {
        id = (
          await tx.pelatihanBatch.create({
            data: {
              idPelatihan, idPenyelenggara: penyMap.get(r.id_penyelenggara as number) ?? null, tahunPelaksanaan: tahun, angkatan,
              tanggalMulai: mulai, tanggalSelesai: selesai, kapasitas: Number(r.kapasitas ?? 0), keterangan: str(r.keterangan),
              statusBatch: str(r.status_batch) ?? "draft", statusAktif: r.status_aktif === true, createdBy: str(r.created_by),
            },
          })
        ).id;
        ada.set(k(idPelatihan, tahun, angkatan), id);
        s.baru++;
      } else s.dipakaiUlang++;
      batchMap.set(r.id as number, id);
    }
  }

  const usulanMap = new Map<number, bigint>();
  {
    const HIDUP = ["mengusulkan", "diajukan", "disetujui"];
    const existing = await tx.pelatihanUsulan.findMany({ select: { id: true, idPegawai: true, idPelatihan: true, tanggalUsulan: true, statusUsulan: true } });
    const ada = new Map(existing.map((r) => [k(r.idPegawai, r.idPelatihan, r.tanggalUsulan.toISOString()), r.id]));
    const hidup = new Set(existing.filter((r) => HIDUP.includes(r.statusUsulan)).map((r) => k(r.idPegawai, r.idPelatihan)));
    for (const r of T("pelatihan_usulan")) {
      const s = stat("usulan");
      const idPegawai = pegMap.get(r.id_pegawai as number);
      const idPelatihan = pelMap.get(r.id_pelatihan as number);
      if (idPegawai === undefined || idPelatihan === undefined) { s.dilewati++; continue; }
      const tanggal = timestamp(r.tanggal_usulan) ?? new Date();
      const key = k(idPegawai, idPelatihan, tanggal.toISOString());
      let id = ada.get(key);
      if (id === undefined) {
        const status = str(r.status_usulan) ?? "mengusulkan";
        if (HIDUP.includes(status) && hidup.has(k(idPegawai, idPelatihan))) {
          warn.push(`Usulan CI4 #${String(r.id)} dilewati: sudah ada usulan aktif untuk pegawai+pelatihan yang sama`);
          s.dilewati++;
          continue;
        }
        id = (
          await tx.pelatihanUsulan.create({
            data: {
              idPegawai, idPelatihan, tanggalUsulan: tanggal, statusUsulan: status, diusulkanOleh: str(r.diusulkan_oleh) ?? "migrasi-ci4",
              diusulkanOlehRole: str(r.diusulkan_oleh_role), alasanUsulan: str(r.alasan_usulan), alasanPenolakan: str(r.alasan_penolakan),
              statusAktif: r.status_aktif === true, jalur: str(r.jalur), tahapSaatIni: null, createdBy: str(r.created_by),
            },
          })
        ).id;
        ada.set(key, id);
        if (HIDUP.includes(status)) hidup.add(k(idPegawai, idPelatihan));
        s.baru++;
      } else s.dipakaiUlang++;
      usulanMap.set(r.id as number, id);
    }
  }

  {
    const ada = new Set((await tx.pelatihanPesertaBatch.findMany({ select: { idBatch: true, idPegawai: true } })).map((r) => k(r.idBatch, r.idPegawai)));
    for (const r of T("pelatihan_peserta_batch")) {
      const s = stat("peserta batch");
      const idBatch = batchMap.get(r.id_batch as number);
      const idPegawai = pegMap.get(r.id_pegawai as number);
      if (idBatch === undefined || idPegawai === undefined) { s.dilewati++; continue; }
      if (ada.has(k(idBatch, idPegawai))) { s.dipakaiUlang++; continue; }
      await tx.pelatihanPesertaBatch.create({
        data: {
          idBatch, idPegawai, idUsulan: usulanMap.get(r.id_usulan as number) ?? null, statusKehadiran: str(r.status_kehadiran) ?? "terdaftar",
          nilaiAkhir: typeof r.nilai_akhir === "number" ? r.nilai_akhir : null, statusLulus: str(r.status_lulus), statusAktif: r.status_aktif === true,
          noSertifikat: str(r.no_sertifikat), tanggalLulus: dateOnly(r.tanggal_lulus), keterangan: str(r.keterangan), createdBy: str(r.created_by),
        },
      });
      ada.add(k(idBatch, idPegawai));
      s.baru++;
    }
  }
}

function print() {
  console.log("\nTabel                      baru  dipakai-ulang  dilewati");
  for (const [n, s] of Object.entries(report)) console.log(`${n.padEnd(26)} ${String(s.baru).padStart(5)} ${String(s.dipakaiUlang).padStart(14)} ${String(s.dilewati).padStart(9)}`);
  if (warn.length) console.log("\nPeringatan:\n" + warn.map((w) => " - " + w).join("\n"));
}

async function main() {
  console.log("Dump:", Object.entries(rows).filter(([n]) => !n.startsWith("ref_") && n !== "log_activity" && n !== "migrations").map(([n, v]) => `${n}=${v.length}`).join(" "));
  if (PARSE_ONLY) return;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak diset");
  console.log(`Target DB host: ${new URL(url).host}  |  mode: ${APPLY ? "APPLY (permanen)" : "DRY-RUN (rollback)"}`);
  const db = new PrismaClient();
  try {
    await db.$transaction(
      async (tx) => {
        await run(tx);
        print();
        if (!APPLY) throw new DryRun();
      },
      { timeout: 10 * 60_000, maxWait: 30_000 },
    );
    console.log("\nSELESAI: perubahan disimpan.");
  } catch (e) {
    if (e instanceof DryRun) console.log("\nDRY-RUN selesai: semua perubahan dibatalkan (rollback). Jalankan dengan --apply untuk menyimpan.");
    else throw e;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
