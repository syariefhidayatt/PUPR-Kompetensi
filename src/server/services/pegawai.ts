import type { Prisma } from "@prisma/client";
import { andOf, ci, fEnum, type Filters } from "@/lib/filters";
import type { BiodataInput, PenempatanInput } from "@/lib/schemas/pegawai";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { pegawaiScope } from "./learning-path";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./master/shared";

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const invalid = (field: string, msg: string) => new AppError("INVALID", 422, msg, { [field]: [msg] });
const tgl = (s: string | undefined) => (s ? new Date(`${s}T00:00:00Z`) : null);
const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// ---------- Daftar ----------
export type PegawaiRow = {
  id: string;
  nip: string;
  nama: string;
  instansi: string;
  unitKerja: string;
  jf: string;
  jenjang: string;
  statusPegawai: string;
  golongan: string;
  pendidikan: string;
  punyaAkun: boolean;
  // untuk form ubah (biodata)
  email: string; hp: string; telp: string; tempatLahir: string; tglLahir: string; jenisKelamin: string;
  agama: string; alamat: string; jurusan: string; tmt: string;
};

export async function listPegawai(scope: Scope, q: string | undefined, page: number, f: Filters = {}) {
  const pen: Prisma.PegawaiPenempatanWhereInput = {
    tglSelesai: null,
    ...(f.instansi ? { instansi: { nama: ci(f.instansi) } } : {}),
    ...(f.unit_organisasi ? { unitOrganisasi: { nama: ci(f.unit_organisasi) } } : {}),
    ...(f.unit_kerja ? { unitKerja: { nama: ci(f.unit_kerja) } } : {}),
    ...(f.jf ? { jf: { namaJf: ci(f.jf) } } : {}),
    ...(f.jenjang ? { jenjang: { nama: ci(f.jenjang) } } : {}),
    ...(f.status_pegawai ? { statusPegawai: ci(f.status_pegawai) } : {}),
  };
  const adaFilterPen = Object.keys(f).some((k) => ["instansi", "unit_organisasi", "unit_kerja", "jf", "jenjang", "status_pegawai"].includes(k));
  const jk = fEnum(f.jk, ["L", "P"] as const);
  const where: Prisma.PegawaiWhereInput = {
    deletedAt: null,
    ...pegawaiScope(scope),
    ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" } }, { nip: { contains: q } }] } : {}),
    AND: andOf<Prisma.PegawaiWhereInput>([
      f.nip && { nip: ci(f.nip) },
      f.nama && { nama: ci(f.nama) },
      f.golongan && { golongan: ci(f.golongan) },
      f.pendidikan && { pendidikan: ci(f.pendidikan) },
      jk && { jenisKelamin: jk },
      adaFilterPen && { penempatan: { some: pen } },
    ]),
  };
  const [rows, total] = await Promise.all([
    db.pegawai.findMany({
      where,
      orderBy: { nama: "asc" },
      skip: skip(page),
      take: PAGE_SIZE,
      include: {
        penempatan: {
          where: { tglSelesai: null },
          take: 1,
          include: { instansi: { select: { nama: true } }, unitKerja: { select: { nama: true } }, jf: { select: { namaJf: true } }, jenjang: { select: { nama: true } } },
        },
      },
    }),
    db.pegawai.count({ where }),
  ]);
  const data: PegawaiRow[] = rows.map((r) => {
    const p = r.penempatan[0];
    return {
      id: ids().encode("pegawai", r.id),
      nip: r.nip,
      nama: r.nama,
      instansi: p?.instansi.nama ?? "—",
      unitKerja: p?.unitKerja?.nama ?? "—",
      jf: p?.jf?.namaJf ?? "—",
      jenjang: p?.jenjang?.nama ?? "—",
      statusPegawai: p?.statusPegawai ?? "—",
      golongan: r.golongan ?? "",
      pendidikan: r.pendidikan ?? "",
      punyaAkun: r.idUser !== null,
      email: r.email ?? "", hp: r.hp ?? "", telp: r.telp ?? "", tempatLahir: r.tempatLahir ?? "", tglLahir: fmt(r.tglLahir),
      jenisKelamin: r.jenisKelamin ?? "", agama: r.agama ?? "", alamat: r.alamat ?? "", jurusan: r.jurusan ?? "", tmt: fmt(r.tmt),
    };
  });
  return { rows: data, total };
}

// ---------- Opsi form (dikirim ke klien; select bertingkat difilter di klien) ----------
export type Opt = { value: string; label: string };
export type PegawaiFormOptions = {
  instansi: Opt[];
  unitOrganisasi: (Opt & { instansi: string })[];
  unitKerja: (Opt & { instansi: string; uo: string })[];
  jf: (Opt & { instansi: string })[];
  jenjang: Opt[];
  status: Opt[];
  golongan: Opt[];
  pendidikan: Opt[];
};

export async function pegawaiFormOptions(scope: Scope): Promise<PegawaiFormOptions> {
  const own: { idInstansi?: bigint; id?: bigint } = scope.kind === "all" ? {} : scope.kind === "instansi" ? { idInstansi: scope.idInstansi } : { id: -1n };
  const [instansi, uo, uk, jf, jenjang, status, golongan, pendidikan] = await Promise.all([
    db.instansi.findMany({ where: scope.kind === "all" ? { statusAktif: true } : scope.kind === "instansi" ? { id: scope.idInstansi } : { id: -1n }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    db.unitOrganisasi.findMany({ where: { ...own, statusAktif: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true, idInstansi: true } }),
    db.unitKerja.findMany({ where: { ...own, statusAktif: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true, idInstansi: true, idUnitOrganisasi: true } }),
    db.jf.findMany({ where: { ...own, statusAktif: true }, orderBy: { namaJf: "asc" }, select: { id: true, namaJf: true, idInstansi: true } }),
    db.jenjangJabatan.findMany({ where: { statusAktif: true }, orderBy: [{ rumpun: "asc" }, { urutan: "asc" }], select: { id: true, nama: true, rumpun: true } }),
    db.statusPegawai.findMany({ where: { statusAktif: true }, orderBy: { nama: "asc" } }),
    db.golongan.findMany({ where: { statusAktif: true }, orderBy: { nama: "asc" } }),
    db.pendidikan.findMany({ where: { statusAktif: true }, orderBy: { nama: "asc" } }),
  ]);
  const e = (k: "instansi" | "unitOrganisasi" | "unitKerja" | "jf" | "jenjang", id: bigint) => ids().encode(k, id);
  return {
    instansi: instansi.map((r) => ({ value: e("instansi", r.id), label: r.nama })),
    unitOrganisasi: uo.map((r) => ({ value: e("unitOrganisasi", r.id), label: r.nama, instansi: e("instansi", r.idInstansi) })),
    unitKerja: uk.map((r) => ({ value: e("unitKerja", r.id), label: r.nama, instansi: e("instansi", r.idInstansi), uo: r.idUnitOrganisasi ? e("unitOrganisasi", r.idUnitOrganisasi) : "" })),
    jf: jf.map((r) => ({ value: e("jf", r.id), label: r.namaJf, instansi: e("instansi", r.idInstansi) })),
    jenjang: jenjang.map((r) => ({ value: e("jenjang", r.id), label: `${r.nama} (${r.rumpun === "KEAHLIAN" ? "Keahlian" : "Keterampilan"})` })),
    status: status.map((r) => ({ value: r.nama, label: r.nama })),
    golongan: golongan.map((r) => ({ value: r.nama, label: r.nama })),
    pendidikan: pendidikan.map((r) => ({ value: r.nama, label: r.nama })),
  };
}

// ---------- Validasi referensi ----------
/** Nilai teks referensi harus ada di master; disimpan dengan penulisan master (kanonik). */
type Finder = { findFirst(a: { where: object }): Promise<{ nama: string } | null> };
async function kanonik(repo: Finder, nilai: string | undefined, field: string, label: string) {
  if (!nilai) return null;
  const r = await repo.findFirst({ where: { nama: { equals: nilai, mode: "insensitive" } } });
  if (!r) throw invalid(field, `${label} tidak ada di master.`);
  return r.nama;
}

async function resolvePenempatan(input: PenempatanInput, scope: Scope) {
  const idInstansi = ids().decode("instansi", input.instansi);
  const inst = idInstansi !== null && (scope.kind === "all" || (scope.kind === "instansi" && scope.idInstansi === idInstansi))
    ? await db.instansi.findUnique({ where: { id: idInstansi }, select: { id: true } })
    : null;
  if (!inst) throw invalid("instansi", "Instansi tidak valid.");

  const pilih = async <T extends { idInstansi: bigint }>(token: string | undefined, kind: "unitOrganisasi" | "unitKerja" | "jf", field: string, load: (id: bigint) => Promise<T | null>) => {
    if (!token) return null;
    const id = ids().decode(kind, token);
    const row = id === null ? null : await load(id);
    if (!row || row.idInstansi !== inst.id) throw invalid(field, "Tidak valid untuk instansi ini.");
    return { id: id as bigint, row };
  };
  const uo = await pilih(input.unitOrganisasi, "unitOrganisasi", "unitOrganisasi", (id) => db.unitOrganisasi.findUnique({ where: { id } }));
  const uk = await pilih(input.unitKerja, "unitKerja", "unitKerja", (id) => db.unitKerja.findUnique({ where: { id } }));
  const jf = await pilih(input.jf, "jf", "jf", (id) => db.jf.findUnique({ where: { id } }));
  if (uo && uk && uk.row.idUnitOrganisasi && uk.row.idUnitOrganisasi !== uo.id) throw invalid("unitKerja", "Unit kerja bukan bagian dari unit organisasi yang dipilih.");

  let idJenjang: bigint | null = null;
  if (input.jenjang) {
    const id = ids().decode("jenjang", input.jenjang);
    const j = id === null ? null : await db.jenjangJabatan.findUnique({ where: { id }, select: { id: true } });
    if (!j) throw invalid("jenjang", "Jenjang tidak valid.");
    idJenjang = j.id;
  }
  const status = await kanonik(db.statusPegawai as unknown as Finder, input.statusPegawai, "statusPegawai", "Status pegawai");
  return { idInstansi: inst.id, idUnitOrganisasi: uo?.id ?? null, idUnitKerja: uk?.id ?? null, idJf: jf?.id ?? null, idJenjang, statusPegawai: status };
}

async function assertNipFree(nip: string, exceptId?: bigint) {
  const dup = await db.pegawai.findFirst({ where: { nip: { equals: nip, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new AppError("CONFLICT", 409, "NIP sudah terdaftar.", { nip: ["NIP sudah dipakai"] });
}

async function biodataData(b: BiodataInput) {
  return {
    nip: b.nip,
    nama: b.nama,
    email: b.email ?? null,
    hp: b.hp ?? null,
    telp: b.telp ?? null,
    tempatLahir: b.tempatLahir ?? null,
    tglLahir: tgl(b.tglLahir),
    jenisKelamin: b.jenisKelamin ?? null,
    agama: b.agama ?? null,
    alamat: b.alamat ?? null,
    jurusan: b.jurusan ?? null,
    tmt: tgl(b.tmt),
    pendidikan: await kanonik(db.pendidikan as unknown as Finder, b.pendidikan, "pendidikan", "Pendidikan"),
    golongan: await kanonik(db.golongan as unknown as Finder, b.golongan, "golongan", "Golongan"),
  };
}

// ---------- Mutasi data ----------
export async function createPegawai(input: { biodata: BiodataInput; penempatan: PenempatanInput }, actor: string, scope: Scope) {
  const pen = await resolvePenempatan(input.penempatan, scope);
  await assertNipFree(input.biodata.nip);
  const data = await biodataData(input.biodata);
  const row = await db.$transaction(async (tx) => {
    const p = await tx.pegawai.create({ data: { ...data, createdBy: actor } });
    await tx.pegawaiPenempatan.create({ data: { idPegawai: p.id, ...pen, tglMulai: tgl(input.penempatan.tglMulai) as Date, noSk: input.penempatan.noSk ?? null, keterangan: input.penempatan.keterangan ?? null } });
    return p;
  });
  await audit("create", { entitas: "Pegawai", entitasId: String(row.id), actor, meta: { nip: row.nip } });
  return { id: ids().encode("pegawai", row.id) };
}

async function pegawaiDalamScope(token: string, scope: Scope) {
  const id = decodeOr404("pegawai", token);
  const p = await db.pegawai.findFirst({ where: { id, deletedAt: null, ...pegawaiScope(scope) } });
  if (!p) throw NOT_FOUND();
  return p;
}

export async function updatePegawai(token: string, input: BiodataInput, actor: string, scope: Scope) {
  const cur = await pegawaiDalamScope(token, scope);
  await assertNipFree(input.nip, cur.id);
  const data = await biodataData(input);
  await db.pegawai.update({ where: { id: cur.id }, data: { ...data, updatedBy: actor } });
  await audit("update", { entitas: "Pegawai", entitasId: String(cur.id), actor, meta: { nip: input.nip } });
}

/** Mutasi/ubah penempatan: menutup penempatan aktif (sehari sebelum tgl mulai baru) dan membuka yang baru. Riwayat tetap utuh. */
export async function mutasiPegawai(token: string, input: PenempatanInput, actor: string, scope: Scope) {
  const cur = await pegawaiDalamScope(token, scope);
  const pen = await resolvePenempatan(input, scope);
  const mulai = tgl(input.tglMulai) as Date;
  await db.$transaction(async (tx) => {
    const aktif = await tx.pegawaiPenempatan.findFirst({ where: { idPegawai: cur.id, tglSelesai: null } });
    if (aktif) {
      if (mulai <= aktif.tglMulai) throw invalid("tglMulai", `Tanggal mulai harus setelah ${fmt(aktif.tglMulai)} (mulai penempatan saat ini).`);
      await tx.pegawaiPenempatan.update({ where: { id: aktif.id }, data: { tglSelesai: new Date(mulai.getTime() - 86_400_000) } });
    }
    await tx.pegawaiPenempatan.create({ data: { idPegawai: cur.id, ...pen, tglMulai: mulai, noSk: input.noSk ?? null, keterangan: input.keterangan ?? null } });
  });
  await audit("update", { entitas: "Pegawai", entitasId: String(cur.id), actor, meta: { aksi: "mutasi", mulai: input.tglMulai } });
}

export async function removePegawai(token: string, actor: string, scope: Scope) {
  const cur = await pegawaiDalamScope(token, scope);
  if (cur.idUser !== null) throw new AppError("CONFLICT", 409, "Pegawai terhubung ke akun pengguna; lepaskan/hapus akunnya terlebih dahulu.");
  conflictIfUsed("Pegawai", [
    ["usulan pelatihan", await db.pelatihanUsulan.count({ where: { idPegawai: cur.id } })],
    ["keikutsertaan batch", await db.pelatihanPesertaBatch.count({ where: { idPegawai: cur.id } })],
  ]);
  await db.$transaction([db.pegawaiPenempatan.deleteMany({ where: { idPegawai: cur.id } }), db.pegawai.delete({ where: { id: cur.id } })]);
  await audit("delete", { entitas: "Pegawai", entitasId: String(cur.id), actor, meta: { nip: cur.nip } });
}

// ---------- Detail ----------
export type RiwayatRow = { id: string; aktif: boolean; mulai: string; selesai: string; instansi: string; unitOrganisasi: string; unitKerja: string; jf: string; jenjang: string; statusPegawai: string; noSk: string };

export async function loadPegawaiDetail(token: string, scope: Scope) {
  const cur = await pegawaiDalamScope(token, scope);
  const pen = await db.pegawaiPenempatan.findMany({
    where: { idPegawai: cur.id },
    orderBy: [{ tglMulai: "desc" }, { id: "desc" }],
    include: { instansi: { select: { nama: true } }, unitOrganisasi: { select: { nama: true } }, unitKerja: { select: { nama: true } }, jf: { select: { namaJf: true } }, jenjang: { select: { nama: true } } },
  });
  const riwayat: RiwayatRow[] = pen.map((p) => ({
    id: String(p.id),
    aktif: p.tglSelesai === null,
    mulai: fmt(p.tglMulai),
    selesai: fmt(p.tglSelesai),
    instansi: p.instansi.nama,
    unitOrganisasi: p.unitOrganisasi?.nama ?? "—",
    unitKerja: p.unitKerja?.nama ?? "—",
    jf: p.jf?.namaJf ?? "—",
    jenjang: p.jenjang?.nama ?? "—",
    statusPegawai: p.statusPegawai ?? "—",
    noSk: p.noSk ?? "",
  }));
  return {
    token,
    biodata: {
      nip: cur.nip, nama: cur.nama, email: cur.email ?? "", hp: cur.hp ?? "", telp: cur.telp ?? "", tempatLahir: cur.tempatLahir ?? "",
      tglLahir: fmt(cur.tglLahir), jenisKelamin: cur.jenisKelamin ?? "", agama: cur.agama ?? "", alamat: cur.alamat ?? "",
      pendidikan: cur.pendidikan ?? "", jurusan: cur.jurusan ?? "", golongan: cur.golongan ?? "", tmt: fmt(cur.tmt), punyaAkun: cur.idUser !== null,
    },
    riwayat,
  };
}
