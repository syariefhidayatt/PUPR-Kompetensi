/**
 * Transformasi baris CI4 → rekaman target (skema Prisma). Murni & dapat diuji.
 * Aturan: baris soft-deleted (deleted_at) tidak diimpor; ID CI4 dipertahankan;
 * baris yang induknya tidak ikut diimpor dibuang dan dilaporkan (tidak diam-diam).
 */
import type { Dump, Row, Val } from "./parse-dump";

/** ASUMSI (belum dikonfirmasi pengguna): kode agama CI4 → label. Ubah di sini bila berbeda. */
export const AGAMA: Record<number, string> = {
  1: "Islam", 2: "Kristen", 3: "Katolik", 4: "Hindu", 5: "Buddha", 6: "Konghucu", 7: "Lainnya",
};

const KEAHLIAN = /pertama|muda|madya|utama/i;
const KETERAMPILAN = /pemula|terampil|mahir|penyelia/i;
const DELETED_SUFFIX = /\s*\(Deleted \d+\)\s*$/;

export const stripDeleted = (s: string) => s.replace(DELETED_SUFFIX, "");
export const rumpunDariNama = (nama: string): "KEAHLIAN" | "KETERAMPILAN" | null =>
  KEAHLIAN.test(nama) ? "KEAHLIAN" : KETERAMPILAN.test(nama) ? "KETERAMPILAN" : null;

const str = (v: Val | undefined) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: Val | undefined) => (v === null || v === undefined ? null : Number(v));
const big = (v: Val | undefined) => (v === null || v === undefined ? null : BigInt(v as number));
const bool = (v: Val | undefined) => v !== false;
export function ts(v: Val | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function dt(v: Val | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  return m ? new Date(`${m[1]}T00:00:00Z`) : null;
}

export type Report = { warnings: string[]; skipped: Record<string, number> };
export type Plan = ReturnType<typeof transform>["plan"];

export function transform(d: Dump) {
  const rows = (t: string): Row[] => d[t] ?? [];
  const warnings: string[] = [];
  const skipped: Record<string, number> = {};
  const skip = (t: string, why: string) => {
    skipped[`${t}: ${why}`] = (skipped[`${t}: ${why}`] ?? 0) + 1;
  };
  const live = (t: string) => {
    const all = rows(t);
    const ok = all.filter((r) => r.deleted_at == null);
    if (all.length !== ok.length) skipped[`${t}: soft-deleted`] = all.length - ok.length;
    return ok;
  };
  const meta = (r: Row) => ({
    createdBy: str(r.created_by),
    updatedBy: str(r.updated_by),
    createdAt: ts(r.created_at) ?? new Date(),
    updatedAt: ts(r.updated_at) ?? ts(r.created_at) ?? new Date(),
  });
  /** Simpan hanya baris yang induknya ada; sisanya dicatat. */
  const keepIf = <T extends Row>(t: string, list: T[], pred: (r: T) => string | null) =>
    list.filter((r) => {
      const why = pred(r);
      if (why) skip(t, why);
      return !why;
    });

  // ---- master dasar ----
  const instansi = live("m_instansi").map((r) => ({
    id: big(r.id)!, nama: String(r.nama_instansi), jenis: num(r.jenis)!, statusAktif: bool(r.status_aktif),
  }));
  const iSet = new Set(instansi.map((x) => x.id));

  const jf = keepIf("m_jf", live("m_jf"), (r) => (iSet.has(big(r.id_instansi)!) ? null : "instansi tidak diimpor")).map((r) => ({
    id: big(r.id)!, idInstansi: big(r.id_instansi)!, kodeJf: str(r.kode_jf), namaJf: String(r.nama_jf), statusAktif: bool(r.status_aktif),
  }));
  const jfSet = new Set(jf.map((x) => x.id));

  const jenjang = live("m_jenjang_jabatan").map((r) => {
    const nama = String(r.nama_jenjang);
    let rumpun = rumpunDariNama(nama);
    if (!rumpun) {
      warnings.push(`Jenjang "${nama}": rumpun tak dikenali, diisi KEAHLIAN (periksa manual).`);
      rumpun = "KEAHLIAN";
    }
    return { id: big(r.id)!, nama, rumpun, urutan: num(r.urutan)!, statusAktif: bool(r.status_aktif) };
  });
  const jjSet = new Set(jenjang.map((x) => x.id));

  const unitOrganisasi = keepIf("m_unit_organisasi", live("m_unit_organisasi"), (r) => (iSet.has(big(r.id_instansi)!) ? null : "instansi tidak diimpor")).map((r) => ({
    id: big(r.id)!, idInstansi: big(r.id_instansi)!, kode: String(r.kode_unit), nama: String(r.nama_unit), statusAktif: bool(r.status_aktif),
  }));
  const uoSet = new Set(unitOrganisasi.map((x) => x.id));
  const unitKerja = keepIf("m_unit_kerja", live("m_unit_kerja"), (r) => (iSet.has(big(r.id_instansi)!) ? null : "instansi tidak diimpor")).map((r) => {
    const uo = big(r.id_unit_organisasi);
    return {
      id: big(r.id)!, idInstansi: big(r.id_instansi)!, idUnitOrganisasi: uo !== null && uoSet.has(uo) ? uo : null,
      kode: String(r.kode_unit_kerja), nama: String(r.nama_unit_kerja), statusAktif: bool(r.status_aktif),
    };
  });
  const ukSet = new Set(unitKerja.map((x) => x.id));

  const sertifikasi = live("m_sertifikasi").map((r) => ({ id: big(r.id)!, nama: String(r.nama_sertifikasi), statusAktif: bool(r.status_aktif) }));
  const sertSet = new Set(sertifikasi.map((x) => x.id));
  const jenis = live("m_jenis_kompetensi").map((r) => ({ id: big(r.id)!, namaJenis: String(r.nama_jenis), statusAktif: bool(r.status_aktif), ...meta(r) }));
  const jenisSet = new Set(jenis.map((x) => x.id));
  const jenisDetail = keepIf("m_jenis_kompetensi_detail", rows("m_jenis_kompetensi_detail"), (r) => (jenisSet.has(big(r.id_jenis)!) ? null : "jenis tidak diimpor")).map((r) => ({
    id: big(r.id)!, idJenis: big(r.id_jenis)!, namaDetail: String(r.nama_detail), statusAktif: bool(r.status_aktif),
  }));
  const detSet = new Set(jenisDetail.map((x) => x.id));

  const kompetensi = keepIf("m_kompetensi", live("m_kompetensi"), (r) =>
    !jfSet.has(big(r.id_jf)!) ? "JF tidak diimpor" : !detSet.has(big(r.id_jenis_detail)!) ? "detail jenis tidak diimpor" : null,
  ).map((r) => ({
    id: big(r.id)!, idJf: big(r.id_jf)!, idJenisDetail: big(r.id_jenis_detail)!, namaKompetensi: String(r.nama_kompetensi), statusAktif: bool(r.status_aktif), ...meta(r),
  }));
  const kompSet = new Set(kompetensi.map((x) => x.id));

  const penyelenggara = live("m_penyelenggara").map((r) => ({ id: big(r.id)!, nama: String(r.nama_penyelenggara), statusAktif: bool(r.status_aktif), ...meta(r) }));
  const pnySet = new Set(penyelenggara.map((x) => x.id));

  const program = keepIf("program_bangkom", live("program_bangkom"), (r) =>
    !jfSet.has(big(r.id_jf)!) ? "JF tidak diimpor" : !detSet.has(big(r.id_jenis_detail)!) ? "detail jenis tidak diimpor" : null,
  ).map((r) => ({
    id: big(r.id)!, idJf: big(r.id_jf)!, idJenisDetail: big(r.id_jenis_detail)!, namaProgram: String(r.nama_program),
    deskripsi: str(r.deskripsi), kategori: str(r.kategori), statusAktif: bool(r.status_aktif), ...meta(r),
  }));
  const progSet = new Set(program.map((x) => x.id));

  const pelatihan = keepIf("pelatihan", live("pelatihan"), (r) => (progSet.has(big(r.id_program)!) ? null : "program tidak diimpor")).map((r) => ({
    id: big(r.id)!, idProgram: big(r.id_program)!, namaPelatihan: String(r.nama_pelatihan), deskripsi: str(r.deskripsi),
    isPeriode: r.is_periode === true, kPeriode: num(r.k_periode), isRefreshment: r.is_refreshment === true, kRefreshment: num(r.k_refreshment),
    isSertifikat: r.is_sertifikat === true, jenisPelatihan: str(r.jenis_pelatihan), kategoriPelatihan: str(r.kategori_pelatihan),
    statusAktif: bool(r.status_aktif), ...meta(r),
  }));
  const pelSet = new Set(pelatihan.map((x) => x.id));

  const pivot = <A extends string, B extends string>(t: string, a: string, b: string, bSet: Set<bigint>, ka: A, kb: B) =>
    keepIf(t, rows(t), (r) => (!pelSet.has(big(r[a])!) ? "pelatihan tidak diimpor" : !bSet.has(big(r[b])!) ? "referensi tidak diimpor" : null)).map(
      (r) => ({ [ka]: big(r[a])!, [kb]: big(r[b])! }) as Record<A | B, bigint>,
    );
  const pelatihanJenjang = pivot("pelatihan_jenjang", "id_pelatihan", "id_jenjang", jjSet, "idPelatihan", "idJenjang");
  const pelatihanKompetensi = pivot("pelatihan_kompetensi", "id_pelatihan", "id_kompetensi", kompSet, "idPelatihan", "idKompetensi");
  const pelatihanSertifikasi = pivot("pelatihan_sertifikasi", "id_pelatihan", "id_sertifikasi", sertSet, "idPelatihan", "idSertifikasi");

  // ---- kepegawaian ----
  const refNama = (t: string, col: string) => new Map(rows(t).map((r) => [big(r.id)!, stripDeleted(String(r[col]))]));
  const pendidikan = refNama("m_pendidikan", "nama_pendidikan");
  const golongan = refNama("m_golongan", "nama_golongan");
  const statusPeg = refNama("m_status_pegawai", "nama_status");

  // ---- user & role ----
  const roleKode = new Map(rows("ref_roles").map((r) => [big(r.id)!, String(r.kode)]));
  /** CI4 → target. superadmin dilebur ke admin_pusat; operator/viewer tidak ada di target. */
  const ROLE_MAP: Record<string, string> = { superadmin: "admin_pusat", admin_pusat: "admin_pusat", admin_instansi: "admin_instansi", pembina: "pembina", pegawai: "pegawai" };
  const users = live("users").map((r) => {
    const hash = str(r.password_hash);
    const argon = hash?.startsWith("$argon2") ? hash : null;
    const roles = new Set<string>();
    for (const ur of rows("ref_user_roles")) {
      if (big(ur.id_user) !== big(r.id)) continue;
      const kode = roleKode.get(big(ur.id_role)!);
      const mapped = kode ? ROLE_MAP[kode] : undefined;
      if (mapped) roles.add(mapped);
      else warnings.push(`User ${String(r.username)}: role "${kode}" tidak punya padanan, dilewati.`);
    }
    const idI = big(r.id_instansi);
    return {
      id: big(r.id)!, username: String(r.username), nama: String(r.nama), email: str(r.email)?.toLowerCase() ?? null,
      passwordHash: argon, googleId: str(r.google_id), authProvider: (String(r.auth_provider) === "google" ? "GOOGLE" : "LOCAL") as "GOOGLE" | "LOCAL",
      statusAktif: bool(r.status_aktif), idInstansi: idI !== null && iSet.has(idI) ? idI : null, roles: [...roles],
      bcryptDibuang: hash !== null && argon === null,
    };
  });
  const userSet = new Set(users.map((x) => x.id));

  const pegawaiLive = live("pegawai");
  const pegawai = pegawaiLive.map((r) => {
    const jk = num(r.jenis_kelamin);
    const ag = num(r.agama);
    const idUser = big(r.id_user);
    return {
      id: big(r.id)!, idUser: idUser !== null && userSet.has(idUser) ? idUser : null,
      nip: String(r.nip), nama: String(r.nama), email: str(r.email)?.toLowerCase() ?? null, hp: str(r.hp), telp: str(r.telp),
      tempatLahir: str(r.tempat_lahir), tglLahir: dt(r.tgl_lahir), jenisKelamin: jk === 1 ? "L" : jk === 2 ? "P" : null,
      agama: ag === null ? null : (AGAMA[ag] ?? String(ag)), alamat: str(r.alamat), jurusan: str(r.jurusan),
      pendidikan: pendidikan.get(big(r.id_pendidikan)!) ?? null, golongan: golongan.get(big(r.id_golongan)!) ?? null, tmt: dt(r.tmt),
      ...meta(r),
    };
  });
  const pegSet = new Set(pegawai.map((x) => x.id));

  const penempatan = keepIf("pegawai_penempatan", rows("pegawai_penempatan"), (r) =>
    !pegSet.has(big(r.id_pegawai)!) ? "pegawai tidak diimpor" : !iSet.has(big(r.id_instansi)!) ? "instansi tidak diimpor" : null,
  ).map((r) => {
    const uo = big(r.id_unit_organisasi), uk = big(r.id_unit_kerja), j = big(r.id_jf), jj = big(r.id_jenjang);
    return {
      id: big(r.id)!, idPegawai: big(r.id_pegawai)!, idInstansi: big(r.id_instansi)!,
      idUnitOrganisasi: uo !== null && uoSet.has(uo) ? uo : null, idUnitKerja: uk !== null && ukSet.has(uk) ? uk : null,
      idJf: j !== null && jfSet.has(j) ? j : null, idJenjang: jj !== null && jjSet.has(jj) ? jj : null,
      statusPegawai: statusPeg.get(big(r.id_status_pegawai)!)?.toUpperCase() ?? null,
      tglMulai: dt(r.tgl_mulai)!, tglSelesai: dt(r.tgl_selesai), noSk: str(r.no_sk), keterangan: str(r.keterangan),
    };
  });

  // ---- batch, peserta, usulan ----
  const batch = keepIf("pelatihan_batch", rows("pelatihan_batch"), (r) => (pelSet.has(big(r.id_pelatihan)!) ? null : "pelatihan tidak diimpor")).map((r) => {
    const p = big(r.id_penyelenggara);
    return {
      id: big(r.id)!, idPelatihan: big(r.id_pelatihan)!, idPenyelenggara: p !== null && pnySet.has(p) ? p : null,
      tahunPelaksanaan: num(r.tahun_pelaksanaan)!, angkatan: String(r.angkatan ?? "I"), tanggalMulai: dt(r.tanggal_mulai)!, tanggalSelesai: dt(r.tanggal_selesai)!,
      kapasitas: num(r.kapasitas) ?? 0, keterangan: str(r.keterangan), statusBatch: String(r.status_batch ?? "draft"), statusAktif: bool(r.status_aktif), ...meta(r),
    };
  });
  const batchSet = new Set(batch.map((x) => x.id));

  const usulan = keepIf("pelatihan_usulan", rows("pelatihan_usulan"), (r) =>
    !pegSet.has(big(r.id_pegawai)!) ? "pegawai tidak diimpor" : !pelSet.has(big(r.id_pelatihan)!) ? "pelatihan tidak diimpor" : null,
  ).map((r) => ({
    id: big(r.id)!, idPegawai: big(r.id_pegawai)!, idPelatihan: big(r.id_pelatihan)!, tanggalUsulan: ts(r.tanggal_usulan) ?? new Date(),
    statusUsulan: String(r.status_usulan), diusulkanOleh: String(r.diusulkan_oleh), diusulkanOlehRole: str(r.diusulkan_oleh_role),
    alasanUsulan: str(r.alasan_usulan), alasanPenolakan: str(r.alasan_penolakan), lampiranPath: str(r.lampiran_path),
    statusAktif: bool(r.status_aktif), jalur: str(r.jalur), tahapSaatIni: str(r.tahap_saat_ini), ...meta(r),
  }));
  const usSet = new Set(usulan.map((x) => x.id));

  const peserta = keepIf("pelatihan_peserta_batch", rows("pelatihan_peserta_batch"), (r) =>
    !batchSet.has(big(r.id_batch)!) ? "batch tidak diimpor" : !pegSet.has(big(r.id_pegawai)!) ? "pegawai tidak diimpor" : null,
  ).map((r) => {
    const u = big(r.id_usulan);
    return {
      id: big(r.id)!, idBatch: big(r.id_batch)!, idPegawai: big(r.id_pegawai)!, idUsulan: u !== null && usSet.has(u) ? u : null,
      statusKehadiran: String(r.status_kehadiran ?? "terdaftar"), nilaiAkhir: num(r.nilai_akhir), statusLulus: str(r.status_lulus),
      statusAktif: bool(r.status_aktif), noSertifikat: str(r.no_sertifikat), tanggalLulus: dt(r.tanggal_lulus), keterangan: str(r.keterangan), ...meta(r),
    };
  });

  const bcrypt = users.filter((u) => u.bcryptDibuang).length;
  if (bcrypt) warnings.push(`${bcrypt} user punya hash bcrypt: diimpor TANPA password (login via Google/reset).`);
  const dupNip = pegawai.length - new Set(pegawai.map((p) => p.nip)).size;
  if (dupNip) warnings.push(`${dupNip} NIP ganda di pegawai: import akan gagal pada unique constraint.`);
  const nonPeg = ["pegawai_sertifikat", "pegawai_angka_kredit", "pelatihan_usulan_tahap", "log_activity"].filter((t) => rows(t).length);
  if (nonPeg.length) warnings.push(`Tidak diimpor (belum ada modelnya): ${nonPeg.map((t) => `${t}=${rows(t).length}`).join(", ")}.`);

  const plan = {
    instansi, jf, jenjang, unitOrganisasi, unitKerja, sertifikasi, jenis, jenisDetail, kompetensi, penyelenggara, program,
    pelatihan, pelatihanJenjang, pelatihanKompetensi, pelatihanSertifikasi, users, pegawai, penempatan, batch, usulan, peserta,
  };
  return { plan, report: { warnings, skipped } satisfies Report };
}
