import { andOf, ci, fEnum, fInt, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import { KEHADIRAN, KEHADIRAN_LABEL, BATCH_STATUS_LABEL } from "@/lib/schemas/batch";
import { RUMPUN_LABEL } from "@/lib/schemas/master";
import type { TableData } from "@/server/export/table-export";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { batchScope } from "./batch";
import { pegawaiScope } from "./learning-path";
import type { LpJenjang } from "./learning-path-calc";
import { jfOptions } from "./master/jf";
import { PAGE_SIZE, decodeOr404, skip } from "./master/shared";
import { hitungKebutuhan, kbTeks, type KbPegawai } from "./pengelolaan-calc";
import { tahunWib } from "./pelatihan-refresh";

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const kehLabel = (s: string) => KEHADIRAN_LABEL[s as (typeof KEHADIRAN)[number]] ?? s;
const batchLabel = (s: string) => BATCH_STATUS_LABEL[s as keyof typeof BATCH_STATUS_LABEL] ?? s;
const LULUS_LABEL: Record<string, string> = { lulus: "Lulus", tidak_lulus: "Tidak lulus" };
const MAKS_PEGAWAI = 5000; // batas pengaman perhitungan kebutuhan per JF
export const MAKS_EKSPOR = 20000;

// =====================================================================================
// 1) Kebutuhan pelatihan
// =====================================================================================
export type KebutuhanRow = {
  token: string;
  nama: string;
  kategori: string;
  wajib: number;
  terlewat: number;
  refresh: number;
  butuh: number; // pegawai unik yang butuh (salah satu status)
  sudahUsul: number;
  belumUsul: number;
  batchTersedia: number;
  program: string;
  jenisKompetensi: string;
  jenjangSyarat: string;
  rekapJenjang: {
    id: string;
    nama: string;
    kebutuhan: number;
    prosesUsulan: number;
    sudahIkut: number;
  }[];
};
export type KebutuhanView = {
  options: { value: string; label: string }[];
  selected: string | null;
  tahun: number;
  jumlahPegawai: number;
  terpotong: boolean;
  rows: KebutuhanRow[];
  detail: null | {
    token: string;
    nama: string;
    pegawai: { nama: string; nip: string; jenjang: string; status: string; usulan: string }[];
  };
};

export function normalisasiTahun(v: number | undefined): number {
  return v && v >= 2000 && v <= 2100 ? v : tahunWib();
}

export async function loadKebutuhan(
  scope: Scope,
  opts: { jf?: string | undefined; tahun?: number | undefined; pelatihan?: string | undefined },
): Promise<KebutuhanView> {
  const tahun = normalisasiTahun(opts.tahun);
  const options = await jfOptions(scope);
  const selected = opts.jf ?? options[0]?.value ?? null;
  const kosong = {
    options,
    selected,
    tahun,
    jumlahPegawai: 0,
    terpotong: false,
    rows: [],
    detail: null,
  } satisfies KebutuhanView;
  if (!selected) return kosong;
  const idJf = decodeOr404("jf", selected);
  if (!options.some((o) => o.value === selected)) throw NOT_FOUND(); // di luar scope = 404

  const [pegawaiRows, jenjangAktif, pelatihanRows] = await Promise.all([
    db.pegawai.findMany({
      where: {
        deletedAt: null,
        ...pegawaiScope(scope),
        penempatan: { some: { tglSelesai: null, idJf, idJenjang: { not: null } } },
      },
      orderBy: { nama: "asc" },
      take: MAKS_PEGAWAI + 1,
      select: {
        id: true,
        nama: true,
        nip: true,
        penempatan: {
          select: { idJf: true, idJenjang: true, tglMulai: true, tglSelesai: true, jenjang: true },
        },
      },
    }),
    db.jenjangJabatan.findMany({
      where: { statusAktif: true },
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
    }),
    db.pelatihan.findMany({
      where: { statusAktif: true, program: { idJf, statusAktif: true } },
      orderBy: { namaPelatihan: "asc" },
      select: {
        id: true,
        namaPelatihan: true,
        kategoriPelatihan: true,
        isSertifikat: true,
        isRefreshment: true,
        kRefreshment: true,
        program: { select: { namaProgram: true, detail: { select: { namaDetail: true } } } },
        jenjang: { select: { idJenjang: true, jenjang: { select: { nama: true } } } },
      },
    }),
  ]);
  const terpotong = pegawaiRows.length > MAKS_PEGAWAI;
  const daftar = pegawaiRows.slice(0, MAKS_PEGAWAI);

  const kolomByRumpun = new Map<string, LpJenjang[]>();
  for (const j of jenjangAktif)
    kolomByRumpun.set(j.rumpun, [
      ...(kolomByRumpun.get(j.rumpun) ?? []),
      { id: j.id, nama: j.nama, urutan: j.urutan },
    ]);

  const info = new Map<string, { nama: string; nip: string; jenjang: string }>();
  const kbPegawai: KbPegawai[] = [];
  for (const p of daftar) {
    const aktif = p.penempatan.find((x) => x.tglSelesai === null && x.idJf === idJf && x.jenjang);
    if (!aktif?.jenjang) continue;
    kbPegawai.push({
      id: p.id,
      rumpun: aktif.jenjang.rumpun,
      jenjang: { id: aktif.jenjang.id, nama: aktif.jenjang.nama, urutan: aktif.jenjang.urutan },
      penempatan: p.penempatan.map((x) => ({
        idJenjang: x.idJenjang,
        tglMulai: x.tglMulai,
        tglSelesai: x.tglSelesai,
      })),
    });
    info.set(String(p.id), {
      nama: p.nama,
      nip: p.nip,
      jenjang: `${aktif.jenjang.nama} (${RUMPUN_LABEL[aktif.jenjang.rumpun]})`,
    });
  }
  const idPegawai = kbPegawai.map((p) => p.id);
  const idPelatihan = pelatihanRows.map((p) => p.id);

  const [hadirRows, usulanRows, batchRows] = await Promise.all([
    db.pelatihanPesertaBatch.findMany({
      where: {
        idPegawai: { in: idPegawai },
        statusAktif: true,
        statusKehadiran: { in: ["hadir", "selesai"] },
        batch: { idPelatihan: { in: idPelatihan } },
      },
      select: {
        idPegawai: true,
        batch: { select: { idPelatihan: true, tahunPelaksanaan: true, tanggalMulai: true } },
      },
    }),
    db.pelatihanUsulan.findMany({
      where: {
        idPegawai: { in: idPegawai },
        idPelatihan: { in: idPelatihan },
        statusAktif: true,
        statusUsulan: { in: ["mengusulkan", "diajukan", "disetujui"] },
      },
      select: { idPegawai: true, idPelatihan: true, statusUsulan: true },
    }),
    db.pelatihanBatch.groupBy({
      by: ["idPelatihan"],
      where: {
        idPelatihan: { in: idPelatihan },
        statusAktif: true,
        statusBatch: { in: ["draft", "terjadwal"] },
      },
      _count: { _all: true },
    }),
  ]);

  const cells = hitungKebutuhan(
    kbPegawai,
    kolomByRumpun,
    pelatihanRows.map((p) => ({
      id: p.id,
      nama: p.namaPelatihan,
      kategori: p.kategoriPelatihan,
      sertifikat: p.isSertifikat,
      isRefreshment: p.isRefreshment,
      kRefreshment: p.kRefreshment,
      jenjang: p.jenjang.map((j) => j.idJenjang),
    })),
    hadirRows.map((h) => ({
      idPegawai: h.idPegawai,
      idPelatihan: h.batch.idPelatihan,
      tahun: h.batch.tahunPelaksanaan,
      tanggalMulai: h.batch.tanggalMulai,
    })),
    tahun,
  );
  const usulanBy = new Map(
    usulanRows.map((u) => [`${u.idPegawai}:${u.idPelatihan}`, u.statusUsulan]),
  );
  const batchBy = new Map(batchRows.map((b) => [String(b.idPelatihan), b._count._all]));
  const jenjangKolom = [
    ...new Map(
      kbPegawai.map((p) => [
        String(p.jenjang.id),
        { id: String(p.jenjang.id), nama: p.jenjang.nama, urutan: p.jenjang.urutan },
      ]),
    ).values(),
  ].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, "id"));
  const jenjangPegawai = new Map(kbPegawai.map((p) => [String(p.id), String(p.jenjang.id)]));
  const hadirByPelatihan = new Map<string, Set<string>>();
  for (const h of hadirRows) {
    const key = String(h.batch.idPelatihan);
    const set = hadirByPelatihan.get(key) ?? new Set<string>();
    set.add(String(h.idPegawai));
    hadirByPelatihan.set(key, set);
  }

  const rows: KebutuhanRow[] = pelatihanRows.map((p) => {
    const cs = cells.filter((c) => c.idPelatihan === p.id);
    const sudah = cs.filter((c) => usulanBy.has(`${c.idPegawai}:${c.idPelatihan}`)).length;
    const pesertaHadir = hadirByPelatihan.get(String(p.id)) ?? new Set<string>();
    const rekapJenjang = jenjangKolom.map((j) => {
      const pegawaiJenjang = new Set(
        kbPegawai.filter((pg) => String(pg.jenjang.id) === j.id).map((pg) => String(pg.id)),
      );
      return {
        id: j.id,
        nama: j.nama,
        kebutuhan: cs.filter((c) => pegawaiJenjang.has(String(c.idPegawai))).length,
        prosesUsulan: cs.filter(
          (c) =>
            pegawaiJenjang.has(String(c.idPegawai)) &&
            usulanBy.has(`${c.idPegawai}:${c.idPelatihan}`),
        ).length,
        sudahIkut: [...pesertaHadir].filter((id) => pegawaiJenjang.has(id)).length,
      };
    });
    return {
      token: ids().encode("pelatihan", p.id),
      nama: p.namaPelatihan,
      kategori: p.kategoriPelatihan ?? "",
      wajib: cs.filter((c) => c.wajib).length,
      terlewat: cs.filter((c) => c.terlewat).length,
      refresh: cs.filter((c) => c.refresh).length,
      butuh: cs.length,
      sudahUsul: sudah,
      belumUsul: cs.length - sudah,
      batchTersedia: batchBy.get(String(p.id)) ?? 0,
      program: p.program.namaProgram,
      jenisKompetensi: p.program.detail.namaDetail,
      jenjangSyarat: p.jenjang.map((j) => j.jenjang.nama).join(", ") || "Semua jenjang",
      rekapJenjang,
    };
  });

  let detail: KebutuhanView["detail"] = null;
  if (opts.pelatihan) {
    const idPel = decodeOr404("pelatihan", opts.pelatihan);
    const pel = pelatihanRows.find((p) => p.id === idPel);
    if (!pel) throw NOT_FOUND(); // pelatihan bukan milik JF terpilih / di luar scope
    detail = {
      token: opts.pelatihan,
      nama: pel.namaPelatihan,
      pegawai: cells
        .filter((c) => c.idPelatihan === idPel)
        .map((c) => {
          const i = info.get(String(c.idPegawai));
          return {
            nama: i?.nama ?? "",
            nip: i?.nip ?? "",
            jenjang: i?.jenjang ?? "",
            status: kbTeks(c),
            usulan: usulanBy.get(`${c.idPegawai}:${c.idPelatihan}`) ?? "",
          };
        })
        .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    };
  }
  return { options, selected, tahun, jumlahPegawai: kbPegawai.length, terpotong, rows, detail };
}

export function kebutuhanTable(v: KebutuhanView): TableData {
  const jf = v.options.find((o) => o.value === v.selected)?.label ?? "";
  const summary: [string, string][] = [
    ["Jabatan fungsional", jf],
    ["Tahun", String(v.tahun)],
    ["Pegawai dihitung", String(v.jumlahPegawai)],
  ];
  if (v.detail) {
    return {
      title: `Kebutuhan Pelatihan - ${v.detail.nama}`,
      summary,
      columns: [
        { header: "No", align: "center", width: 12 },
        { header: "Pegawai" },
        { header: "NIP" },
        { header: "Jenjang" },
        { header: "Kebutuhan" },
        { header: "Usulan" },
      ],
      rows: v.detail.pegawai.map((p, i) => [
        i + 1,
        p.nama,
        p.nip,
        p.jenjang,
        p.status,
        p.usulan || "Belum diusulkan",
      ]),
    };
  }
  return {
    title: "Kebutuhan Pelatihan",
    summary,
    columns: [
      { header: "No", align: "center", width: 12 },
      { header: "Pelatihan" },
      { header: "Kategori" },
      { header: "Wajib sekarang", align: "right" },
      { header: "Terlewat", align: "right" },
      { header: "Perlu refresh", align: "right" },
      { header: "Total butuh", align: "right" },
      { header: "Sudah diusulkan", align: "right" },
      { header: "Belum diusulkan", align: "right" },
      { header: "Batch tersedia", align: "right" },
      ...[...new Set(v.rows.flatMap((r) => r.rekapJenjang.map((j) => j.nama)))].flatMap((nama) => [
        { header: `Kebutuhan - ${nama}`, align: "right" as const },
        { header: `Proses usulan - ${nama}`, align: "right" as const },
        { header: `Sudah ikut - ${nama}`, align: "right" as const },
      ]),
    ],
    rows: v.rows.map((r, i) => [
      i + 1,
      r.nama,
      r.kategori,
      r.wajib,
      r.terlewat,
      r.refresh,
      r.butuh,
      r.sudahUsul,
      r.belumUsul,
      r.batchTersedia,
      ...r.rekapJenjang.flatMap((j) => [j.kebutuhan, j.prosesUsulan, j.sudahIkut]),
    ]),
  };
}

// =====================================================================================
// 2) Verifikasi kehadiran
// =====================================================================================
export type VerifBatchRow = {
  token: string;
  pelatihan: string;
  tahun: number;
  angkatan: string;
  mulai: string;
  selesai: string;
  status: string;
  peserta: number;
  belumDiverifikasi: number;
};

/** Batch yang sudah layak diverifikasi (terjadwal/berjalan/selesai). `belumDiverifikasi` = peserta berstatus "terdaftar". */
export async function listBatchVerifikasi(
  scope: Scope,
  q: string | undefined,
  page: number,
  f: Filters = {},
) {
  const tahun = fInt(f.tahun);
  const where: Prisma.PelatihanBatchWhereInput = {
    AND: [
      batchScope(scope),
      { statusAktif: true, statusBatch: { in: ["terjadwal", "berjalan", "selesai"] } },
      ...andOf<Prisma.PelatihanBatchWhereInput>([
        q && { pelatihan: { namaPelatihan: ci(q)! } },
        f.pelatihan && { pelatihan: { namaPelatihan: ci(f.pelatihan)! } },
        tahun !== undefined && { tahunPelaksanaan: tahun },
        f.perlu === "ya" && {
          peserta: { some: { statusAktif: true, statusKehadiran: "terdaftar" } },
        },
        fEnum(f.status, ["terjadwal", "berjalan", "selesai"] as const) && {
          statusBatch: f.status!,
        },
      ]),
    ],
  };
  const [total, rows] = await Promise.all([
    db.pelatihanBatch.count({ where }),
    db.pelatihanBatch.findMany({
      where,
      orderBy: [{ tanggalMulai: "desc" }, { id: "desc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: {
        pelatihan: { select: { namaPelatihan: true } },
        peserta: { where: { statusAktif: true }, select: { statusKehadiran: true } },
      },
    }),
  ]);
  return {
    total,
    rows: rows.map<VerifBatchRow>((b) => ({
      token: ids().encode("batch", b.id),
      pelatihan: b.pelatihan.namaPelatihan,
      tahun: b.tahunPelaksanaan,
      angkatan: b.angkatan,
      mulai: ymd(b.tanggalMulai),
      selesai: ymd(b.tanggalSelesai),
      status: b.statusBatch,
      peserta: b.peserta.length,
      belumDiverifikasi: b.peserta.filter((p) => p.statusKehadiran === "terdaftar").length,
    })),
  };
}

export type VerifDetail = {
  token: string;
  pelatihan: string;
  tahun: number;
  angkatan: string;
  mulai: string;
  selesai: string;
  penyelenggara: string;
  status: string;
  bisaDiverifikasi: boolean;
  peserta: {
    token: string;
    nama: string;
    nip: string;
    unitOrganisasi: string;
    unitKerja: string;
    jabatan: string;
    kehadiran: string;
    nilai: string;
    lulus: string;
    diubahOleh: string;
    diubahPada: string;
  }[];
};

const BISA_VERIF = ["terjadwal", "berjalan", "selesai"];

export async function detailVerifikasi(scope: Scope, token: string): Promise<VerifDetail> {
  const id = decodeOr404("batch", token);
  const b = await db.pelatihanBatch.findFirst({
    where: { id, ...batchScope(scope) },
    include: {
      pelatihan: { select: { namaPelatihan: true } },
      penyelenggara: { select: { nama: true } },
      peserta: {
        where: { statusAktif: true },
        orderBy: { pegawai: { nama: "asc" } },
        include: {
          pegawai: {
            select: {
              nama: true,
              nip: true,
              penempatan: {
                where: { tglSelesai: null },
                take: 1,
                select: {
                  jf: { select: { namaJf: true } },
                  jenjang: { select: { nama: true } },
                  unitOrganisasi: { select: { nama: true } },
                  unitKerja: { select: { nama: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!b) throw NOT_FOUND();
  return {
    token,
    pelatihan: b.pelatihan.namaPelatihan,
    tahun: b.tahunPelaksanaan,
    angkatan: b.angkatan,
    mulai: ymd(b.tanggalMulai),
    selesai: ymd(b.tanggalSelesai),
    status: b.statusBatch,
    penyelenggara: b.penyelenggara?.nama ?? "—",
    bisaDiverifikasi: b.statusAktif && BISA_VERIF.includes(b.statusBatch),
    peserta: b.peserta.map((p) => {
      const pen = p.pegawai.penempatan[0];
      return {
        token: ids().encode("peserta", p.id),
        nama: p.pegawai.nama,
        nip: p.pegawai.nip,
        unitOrganisasi: pen?.unitOrganisasi?.nama ?? "—",
        unitKerja: pen?.unitKerja?.nama ?? "—",
        jabatan: [pen?.jf?.namaJf, pen?.jenjang?.nama].filter(Boolean).join(" / ") || "—",
        kehadiran: p.statusKehadiran,
        nilai: p.nilaiAkhir === null ? "" : String(p.nilaiAkhir),
        lulus: p.statusLulus ?? "",
        diubahOleh: p.updatedBy ?? "",
        diubahPada: p.updatedAt.toISOString(),
      };
    }),
  };
}

/**
 * Simpan status kehadiran banyak peserta sekaligus dalam satu transaksi.
 * Semua peserta harus milik batch ini & dalam scope; hanya baris yang berubah yang ditulis.
 */
export async function simpanVerifikasi(
  token: string,
  entries: { token: string; status: string }[],
  actor: string,
  scope: Scope,
): Promise<{ diubah: number }> {
  if (entries.length === 0 || entries.length > 1000)
    throw new AppError("INVALID", 422, "Tidak ada perubahan untuk disimpan.");
  for (const e of entries)
    if (!(KEHADIRAN as readonly string[]).includes(e.status))
      throw new AppError("INVALID", 422, "Status kehadiran tidak valid.");
  const idBatch = decodeOr404("batch", token);
  const batch = await db.pelatihanBatch.findFirst({
    where: { id: idBatch, ...batchScope(scope) },
    select: { id: true, statusBatch: true, statusAktif: true },
  });
  if (!batch) throw NOT_FOUND();
  if (!batch.statusAktif || !BISA_VERIF.includes(batch.statusBatch)) {
    throw new AppError(
      "CONFLICT",
      409,
      "Kehadiran hanya dapat diverifikasi pada batch yang sudah terjadwal, berjalan, atau selesai.",
    );
  }
  const dipilih = new Map<bigint, string>();
  for (const e of entries) dipilih.set(decodeOr404("peserta", e.token), e.status);

  const diubah = await db.$transaction(async (tx) => {
    const ada = await tx.pelatihanPesertaBatch.findMany({
      where: { idBatch, id: { in: [...dipilih.keys()] }, statusAktif: true },
      select: { id: true, statusKehadiran: true },
    });
    if (ada.length !== dipilih.size) throw NOT_FOUND(); // ada peserta yang bukan milik batch ini
    let n = 0;
    for (const p of ada) {
      const baru = dipilih.get(p.id)!;
      if (baru === p.statusKehadiran) continue;
      await tx.pelatihanPesertaBatch.update({
        where: { id: p.id },
        data: { statusKehadiran: baru, updatedBy: actor },
      });
      n++;
    }
    return n;
  });
  if (diubah > 0)
    await audit("kehadiran.verifikasi", {
      entitas: "PelatihanBatch",
      entitasId: String(idBatch),
      actor,
      meta: { diubah },
    });
  return { diubah };
}

/** Perbaikan data peserta; alasan disimpan pada audit log untuk jejak perubahan. */
export async function perbaikiDataKehadiran(
  tokenBatch: string,
  tokenPeserta: string,
  input: { statusKehadiran: string; nilai: number | null; statusLulus: string; alasan: string },
  actor: string,
  scope: Scope,
): Promise<void> {
  if (!(KEHADIRAN as readonly string[]).includes(input.statusKehadiran))
    throw new AppError("INVALID", 422, "Status kehadiran tidak valid.");
  if (
    input.nilai !== null &&
    (!Number.isFinite(input.nilai) || input.nilai < 0 || input.nilai > 100)
  )
    throw new AppError("INVALID", 422, "Nilai harus antara 0 sampai 100.");
  if (!["lulus", "tidak_lulus"].includes(input.statusLulus))
    throw new AppError("INVALID", 422, "Status kelulusan tidak valid.");
  const idBatch = decodeOr404("batch", tokenBatch);
  const idPeserta = decodeOr404("peserta", tokenPeserta);
  const batch = await db.pelatihanBatch.findFirst({
    where: { id: idBatch, ...batchScope(scope) },
    select: { id: true, statusAktif: true, statusBatch: true },
  });
  if (!batch || !batch.statusAktif || !BISA_VERIF.includes(batch.statusBatch)) throw NOT_FOUND();
  const peserta = await db.pelatihanPesertaBatch.findFirst({
    where: { id: idPeserta, idBatch, statusAktif: true },
    select: { id: true, statusKehadiran: true, nilaiAkhir: true, statusLulus: true },
  });
  if (!peserta) throw NOT_FOUND();
  await db.pelatihanPesertaBatch.update({
    where: { id: idPeserta },
    data: {
      statusKehadiran: input.statusKehadiran,
      nilaiAkhir: input.nilai,
      statusLulus: input.statusLulus,
      updatedBy: actor,
    },
  });
  await audit("kehadiran.perbaikan", {
    entitas: "PelatihanPesertaBatch",
    entitasId: String(idPeserta),
    actor,
    meta: {
      alasan: input.alasan,
      sebelum: {
        statusKehadiran: peserta.statusKehadiran,
        nilai: peserta.nilaiAkhir === null ? null : Number(peserta.nilaiAkhir),
        statusLulus: peserta.statusLulus,
      },
      sesudah: {
        statusKehadiran: input.statusKehadiran,
        nilai: input.nilai,
        statusLulus: input.statusLulus,
      },
    },
  });
}

export function verifikasiTable(d: VerifDetail): TableData {
  return {
    title: `Daftar Kehadiran - ${d.pelatihan}`,
    subtitle: `${d.tahun} - Angkatan ${d.angkatan} - ${d.mulai} s/d ${d.selesai}`,
    summary: [
      ["Status batch", batchLabel(d.status)],
      ["Jumlah peserta", String(d.peserta.length)],
    ],
    columns: [
      { header: "No", align: "center", width: 12 },
      { header: "Nama" },
      { header: "NIP" },
      { header: "Kehadiran" },
      { header: "Terakhir diubah oleh" },
    ],
    rows: d.peserta.map((p, i) => [i + 1, p.nama, p.nip, kehLabel(p.kehadiran), p.diubahOleh]),
  };
}

// =====================================================================================
// 3) Rekap peserta
// =====================================================================================
export function rekapWhere(
  scope: Scope,
  f: Filters,
  q?: string,
): Prisma.PelatihanPesertaBatchWhereInput {
  const tahun = fInt(f.tahun);
  const keh = fEnum(f.kehadiran, KEHADIRAN);
  const sb = fEnum(f.status_batch, [
    "draft",
    "terjadwal",
    "berjalan",
    "selesai",
    "dibatalkan",
  ] as const);
  const cari = q ?? f.pegawai;
  return {
    AND: [
      { statusAktif: true, batch: batchScope(scope), pegawai: { deletedAt: null } },
      ...andOf<Prisma.PelatihanPesertaBatchWhereInput>([
        cari && { pegawai: { OR: [{ nama: ci(cari)! }, { nip: { contains: cari } }] } },
        f.pelatihan && { batch: { pelatihan: { namaPelatihan: ci(f.pelatihan)! } } },
        f.instansi && {
          batch: { pelatihan: { program: { jf: { instansi: { nama: ci(f.instansi)! } } } } },
        },
        tahun !== undefined && { batch: { tahunPelaksanaan: tahun } },
        keh && { statusKehadiran: keh },
        f.lulus === "belum"
          ? { statusLulus: null }
          : fEnum(f.lulus, ["lulus", "tidak_lulus"] as const) && { statusLulus: f.lulus! },
        sb && { batch: { statusBatch: sb } },
      ]),
    ],
  };
}

export type RekapRow = {
  token: string;
  jabatan: string;
  unitOrganisasi: string;
  unitKerja: string;
  program: string;
  penyelenggara: string;
  kehadiranKode: string;
  lulusKode: string;
  nama: string;
  nip: string;
  pelatihan: string;
  instansi: string;
  tahun: number;
  angkatan: string;
  mulai: string;
  selesai: string;
  batchStatus: string;
  kehadiran: string;
  nilai: string;
  lulus: string;
  noSertifikat: string;
  tanggalLulus: string;
};
const rekapInclude = {
  pegawai: {
    select: {
      nama: true,
      nip: true,
      penempatan: {
        where: { tglSelesai: null },
        take: 1,
        select: {
          jf: { select: { namaJf: true } },
          jenjang: { select: { nama: true } },
          unitOrganisasi: { select: { nama: true } },
          unitKerja: { select: { nama: true } },
        },
      },
    },
  },
  batch: {
    include: {
      penyelenggara: { select: { nama: true } },
      pelatihan: {
        select: {
          namaPelatihan: true,
          program: {
            select: { namaProgram: true, jf: { select: { instansi: { select: { nama: true } } } } },
          },
        },
      },
    },
  },
} satisfies Prisma.PelatihanPesertaBatchInclude;

function toRekapRow(
  p: Prisma.PelatihanPesertaBatchGetPayload<{ include: typeof rekapInclude }>,
): RekapRow {
  const pen = p.pegawai.penempatan[0];
  return {
    token: ids().encode("peserta", p.id),
    jabatan: [pen?.jf?.namaJf, pen?.jenjang?.nama].filter(Boolean).join(" / "),
    unitOrganisasi: pen?.unitOrganisasi?.nama ?? "",
    unitKerja: pen?.unitKerja?.nama ?? "",
    program: p.batch.pelatihan.program.namaProgram,
    penyelenggara: p.batch.penyelenggara?.nama ?? "",
    kehadiranKode: p.statusKehadiran,
    lulusKode: p.statusLulus ?? "",
    nama: p.pegawai.nama,
    nip: p.pegawai.nip,
    pelatihan: p.batch.pelatihan.namaPelatihan,
    instansi: p.batch.pelatihan.program.jf.instansi.nama,
    tahun: p.batch.tahunPelaksanaan,
    angkatan: p.batch.angkatan,
    mulai: ymd(p.batch.tanggalMulai),
    selesai: ymd(p.batch.tanggalSelesai),
    batchStatus: batchLabel(p.batch.statusBatch),
    kehadiran: kehLabel(p.statusKehadiran),
    nilai: p.nilaiAkhir === null ? "" : p.nilaiAkhir.toString(),
    lulus: p.statusLulus ? (LULUS_LABEL[p.statusLulus] ?? p.statusLulus) : "",
    noSertifikat: p.noSertifikat ?? "",
    tanggalLulus: p.tanggalLulus ? ymd(p.tanggalLulus) : "",
  };
}

const rekapOrder: Prisma.PelatihanPesertaBatchOrderByWithRelationInput[] = [
  { batch: { tanggalMulai: "desc" } },
  { pegawai: { nama: "asc" } },
  { id: "asc" },
];

export async function listRekap(
  scope: Scope,
  q: string | undefined,
  page: number,
  f: Filters = {},
) {
  const where = rekapWhere(scope, f, q);
  const [total, rows, perStatus] = await Promise.all([
    db.pelatihanPesertaBatch.count({ where }),
    db.pelatihanPesertaBatch.findMany({
      where,
      orderBy: rekapOrder,
      skip: skip(page),
      take: PAGE_SIZE,
      include: rekapInclude,
    }),
    db.pelatihanPesertaBatch.groupBy({ by: ["statusKehadiran"], where, _count: { _all: true } }),
  ]);
  const ringkas = Object.fromEntries(KEHADIRAN.map((k) => [k, 0])) as Record<
    (typeof KEHADIRAN)[number],
    number
  >;
  for (const s of perStatus)
    if (s.statusKehadiran in ringkas)
      ringkas[s.statusKehadiran as (typeof KEHADIRAN)[number]] = s._count._all;
  return { total, rows: rows.map(toRekapRow), ringkas };
}

export type RekapBatchRow = {
  pelatihan: string;
  tahun: number;
  angkatan: string;
  mulai: string;
  status: string;
  total: number;
  terdaftar: number;
  hadir: number;
  selesai: number;
  tidakHadir: number;
  lulus: number;
};

/** Agregat per batch dari peserta yang cocok dengan filter yang sama. */
export async function rekapPerBatch(
  scope: Scope,
  q: string | undefined,
  f: Filters = {},
): Promise<RekapBatchRow[]> {
  const where = rekapWhere(scope, f, q);
  const [grup, lulus] = await Promise.all([
    db.pelatihanPesertaBatch.groupBy({
      by: ["idBatch", "statusKehadiran"],
      where,
      _count: { _all: true },
    }),
    db.pelatihanPesertaBatch.groupBy({
      by: ["idBatch"],
      where: { AND: [where, { statusLulus: "lulus" }] },
      _count: { _all: true },
    }),
  ]);
  const idBatch = [...new Set(grup.map((g) => g.idBatch))];
  const batches = await db.pelatihanBatch.findMany({
    where: { id: { in: idBatch } },
    include: { pelatihan: { select: { namaPelatihan: true } } },
  });
  const lulusBy = new Map(lulus.map((l) => [l.idBatch, l._count._all]));
  return batches
    .map((b) => {
      const n = (s: string) =>
        grup.find((g) => g.idBatch === b.id && g.statusKehadiran === s)?._count._all ?? 0;
      const row: RekapBatchRow = {
        pelatihan: b.pelatihan.namaPelatihan,
        tahun: b.tahunPelaksanaan,
        angkatan: b.angkatan,
        mulai: ymd(b.tanggalMulai),
        status: batchLabel(b.statusBatch),
        terdaftar: n("terdaftar"),
        hadir: n("hadir"),
        selesai: n("selesai"),
        tidakHadir: n("tidak_hadir"),
        lulus: lulusBy.get(b.id) ?? 0,
        total: 0,
      };
      row.total = row.terdaftar + row.hadir + row.selesai + row.tidakHadir;
      return { row, mulai: b.tanggalMulai.getTime() };
    })
    .sort((a, b) => b.mulai - a.mulai || a.row.pelatihan.localeCompare(b.row.pelatihan, "id"))
    .map((x) => x.row);
}

export async function rekapTable(
  scope: Scope,
  q: string | undefined,
  f: Filters,
  tampil: "peserta" | "batch",
): Promise<TableData | null> {
  const where = rekapWhere(scope, f, q);
  const aktif = Object.entries(f)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const subtitle =
    [q ? `Pencarian: ${q}` : "", aktif ? `Filter: ${aktif}` : ""].filter(Boolean).join(" | ") ||
    undefined;
  if (tampil === "batch") {
    const rows = await rekapPerBatch(scope, q, f);
    return {
      title: "Rekap Peserta per Batch",
      ...(subtitle ? { subtitle } : {}),
      summary: [
        ["Jumlah batch", String(rows.length)],
        ["Total peserta", String(rows.reduce((a, r) => a + r.total, 0))],
      ],
      columns: [
        { header: "No", align: "center", width: 12 },
        { header: "Pelatihan" },
        { header: "Tahun", align: "center" },
        { header: "Angkatan", align: "center" },
        { header: "Mulai" },
        { header: "Status batch" },
        { header: "Peserta", align: "right" },
        { header: "Terdaftar", align: "right" },
        { header: "Hadir", align: "right" },
        { header: "Selesai", align: "right" },
        { header: "Tidak hadir", align: "right" },
        { header: "Lulus", align: "right" },
      ],
      rows: rows.map((r, i) => [
        i + 1,
        r.pelatihan,
        r.tahun,
        r.angkatan,
        r.mulai,
        r.status,
        r.total,
        r.terdaftar,
        r.hadir,
        r.selesai,
        r.tidakHadir,
        r.lulus,
      ]),
    };
  }
  const [total, rows] = await Promise.all([
    db.pelatihanPesertaBatch.count({ where }),
    db.pelatihanPesertaBatch.findMany({
      where,
      orderBy: rekapOrder,
      take: MAKS_EKSPOR,
      include: rekapInclude,
    }),
  ]);
  const data = rows.map(toRekapRow);
  const catatan = [
    subtitle,
    total > MAKS_EKSPOR ? `Menampilkan ${MAKS_EKSPOR} dari ${total} baris (persempit filter)` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  return {
    title: "Rekap Peserta Pelatihan",
    ...(catatan ? { subtitle: catatan } : {}),
    summary: [["Total peserta", String(total)]],
    columns: [
      { header: "No", align: "center", width: 12 },
      { header: "Nama" },
      { header: "NIP" },
      { header: "Pelatihan" },
      { header: "Instansi" },
      { header: "Tahun", align: "center" },
      { header: "Angkatan", align: "center" },
      { header: "Mulai" },
      { header: "Selesai" },
      { header: "Kehadiran" },
      { header: "Nilai", align: "right" },
      { header: "Kelulusan" },
      { header: "No. sertifikat" },
    ],
    rows: data.map((r, i) => [
      i + 1,
      r.nama,
      r.nip,
      r.pelatihan,
      r.instansi,
      r.tahun,
      r.angkatan,
      r.mulai,
      r.selesai,
      r.kehadiran,
      r.nilai,
      r.lulus,
      r.noSertifikat,
    ]),
  };
}

// ---------- Sertifikat (cetak lewat browser) ----------
export async function detailSertifikat(scope: Scope, token: string) {
  const id = decodeOr404("peserta", token);
  const p = await db.pelatihanPesertaBatch.findFirst({
    where: { AND: [{ id, statusAktif: true, batch: batchScope(scope) }] },
    include: rekapInclude,
  });
  // Hanya peserta lulus yang bernomor sertifikat; selain itu diperlakukan sebagai tidak ada.
  if (!p || p.statusLulus !== "lulus" || !p.noSertifikat) throw NOT_FOUND();
  return toRekapRow(p);
}
