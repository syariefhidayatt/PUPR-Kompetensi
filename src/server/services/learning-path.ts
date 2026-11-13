import type { Prisma } from "@prisma/client";
import { RUMPUN_LABEL } from "@/lib/schemas/master";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { decodeOr404 } from "./master/shared";
import {
  buildLearningPath,
  jenjangPadaTanggal,
  type LpRiwayat,
  type LpRow,
  type LpSummary,
} from "./learning-path-calc";
import { tahunWib } from "./pelatihan-refresh";

export type LearningPathView =
  | { state: "tidak_ada_pegawai" } // akun belum terhubung ke data pegawai
  | { state: "belum_penempatan"; pegawai: PegawaiInfo } // belum ada penempatan aktif lengkap (JF + jenjang)
  | {
      state: "ok";
      pegawai: PegawaiInfo;
      tahun: number;
      jenjangSekarang: string;
      kolom: { id: string; nama: string; sekarang: boolean }[];
      rows: (LpRow & { usulan: string | null })[];
      summary: LpSummary;
    };

export type PegawaiInfo = { nama: string; nip: string; jf: string | null; jenjang: string | null };

export type LpContext = { idUser: bigint; scope: Scope; canPick: boolean };

const USULAN_AKTIF = ["mengusulkan", "diajukan", "disetujui"];

/** Pegawai yang boleh dilihat aktor: penempatan aktifnya di instansi aktor, atau memakai JF milik instansi aktor (pembina lintas instansi). */
export function pegawaiScope(scope: Scope): Prisma.PegawaiWhereInput {
  if (scope.kind === "all") return {};
  if (scope.kind === "instansi") {
    return { penempatan: { some: { tglSelesai: null, OR: [{ idInstansi: scope.idInstansi }, { jf: { idInstansi: scope.idInstansi } }] } } };
  }
  return { id: -1n };
}

export async function cariPegawai(ctx: LpContext, q: string | undefined) {
  if (!ctx.canPick) return [];
  const rows = await db.pegawai.findMany({
    where: {
      deletedAt: null,
      ...pegawaiScope(ctx.scope),
      ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" } }, { nip: { contains: q } }] } : {}),
    },
    orderBy: { nama: "asc" },
    take: 20,
    select: { id: true, nama: true, nip: true, penempatan: { where: { tglSelesai: null }, select: { jf: { select: { namaJf: true } } } } },
  });
  return rows.map((r) => ({
    token: ids().encode("pegawai", r.id),
    label: `${r.nama} (${r.nip})${r.penempatan[0]?.jf ? ` — ${r.penempatan[0].jf.namaJf}` : ""}`,
  }));
}

export async function loadLearningPath(
  ctx: LpContext,
  opts: { pegawai?: string | undefined; tahun?: number | undefined },
): Promise<LearningPathView> {
  const tahun = opts.tahun && opts.tahun >= 2000 && opts.tahun <= 2100 ? opts.tahun : tahunWib();

  let pegawai;
  if (opts.pegawai) {
    // Melihat pegawai lain hanya untuk yang berhak memilih, dan hanya dalam scope (selain itu 404).
    if (!ctx.canPick) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
    const id = decodeOr404("pegawai", opts.pegawai);
    pegawai = await db.pegawai.findFirst({ where: { id, deletedAt: null, ...pegawaiScope(ctx.scope) } });
    if (!pegawai) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  } else {
    pegawai = await db.pegawai.findFirst({ where: { idUser: ctx.idUser, deletedAt: null } });
    if (!pegawai) return { state: "tidak_ada_pegawai" };
  }

  const penempatan = await db.pegawaiPenempatan.findMany({
    where: { idPegawai: pegawai.id },
    orderBy: { tglMulai: "desc" },
    include: { jf: { select: { id: true, namaJf: true } }, jenjang: true },
  });
  const aktif = penempatan.find((p) => p.tglSelesai === null);
  const info: PegawaiInfo = {
    nama: pegawai.nama,
    nip: pegawai.nip,
    jf: aktif?.jf?.namaJf ?? null,
    jenjang: aktif?.jenjang?.nama ?? null,
  };
  if (!aktif?.jf || !aktif.jenjang) return { state: "belum_penempatan", pegawai: info };

  const idJf = aktif.jf.id;
  const sekarang = aktif.jenjang;

  const [kolom, pelatihan, peserta, usulan] = await Promise.all([
    // Kolom hanya dari rumpun jenjang sekarang: perbandingan urutan tidak bermakna lintas rumpun.
    db.jenjangJabatan.findMany({ where: { statusAktif: true, rumpun: sekarang.rumpun }, orderBy: [{ urutan: "asc" }, { nama: "asc" }] }),
    db.pelatihan.findMany({
      where: { statusAktif: true, program: { idJf, statusAktif: true } },
      orderBy: { namaPelatihan: "asc" },
      select: {
        id: true, namaPelatihan: true, kategoriPelatihan: true, isSertifikat: true, isRefreshment: true, kRefreshment: true,
        jenjang: { select: { idJenjang: true } },
      },
    }),
    db.pelatihanPesertaBatch.findMany({
      where: { idPegawai: pegawai.id, statusAktif: true, statusKehadiran: { in: ["hadir", "selesai"] }, batch: { pelatihan: { program: { idJf } } } },
      select: { batch: { select: { idPelatihan: true, tahunPelaksanaan: true, tanggalMulai: true } } },
    }),
    db.pelatihanUsulan.findMany({
      where: { idPegawai: pegawai.id, statusAktif: true, statusUsulan: { in: USULAN_AKTIF } },
      select: { idPelatihan: true, statusUsulan: true },
    }),
  ]);

  const riwayat: LpRiwayat[] = peserta.map((r) => ({
    idPelatihan: r.batch.idPelatihan,
    tahun: r.batch.tahunPelaksanaan,
    // Jenjang saat pelatihan diikuti = jenjang menurut riwayat penempatan pada tanggal mulai batch.
    idJenjang: jenjangPadaTanggal(penempatan, r.batch.tanggalMulai, sekarang.id),
  }));

  const sekarangLp = { id: sekarang.id, nama: sekarang.nama, urutan: sekarang.urutan };
  const { rows, summary } = buildLearningPath(
    kolom.map((k) => ({ id: k.id, nama: k.nama, urutan: k.urutan })),
    sekarangLp,
    pelatihan.map((p) => ({
      id: p.id, nama: p.namaPelatihan, kategori: p.kategoriPelatihan, sertifikat: p.isSertifikat,
      isRefreshment: p.isRefreshment, kRefreshment: p.kRefreshment, jenjang: p.jenjang.map((j) => j.idJenjang),
    })),
    riwayat,
    tahun,
  );
  const usulanByPel = new Map(usulan.map((u) => [String(u.idPelatihan), u.statusUsulan]));

  return {
    state: "ok",
    pegawai: info,
    tahun,
    jenjangSekarang: `${sekarang.nama} (${RUMPUN_LABEL[sekarang.rumpun]})`,
    kolom: kolom.map((k) => ({ id: String(k.id), nama: k.nama, sekarang: k.id === sekarang.id })),
    rows: rows.map((r) => ({ ...r, usulan: usulanByPel.get(r.id) ?? null })),
    summary,
  };
}
