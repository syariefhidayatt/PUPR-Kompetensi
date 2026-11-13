import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import { Prisma } from "@prisma/client";
import { usulanSchema } from "@/lib/schemas/usulan";
import type { Scope } from "@/server/auth/rbac";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import type { z } from "zod";
import { pegawaiScope } from "./learning-path";
import { decodeOr404, PAGE_SIZE, skip } from "./master/shared";
import { batchTerbukaPerPelatihan } from "./usulan-approval";
import {
  bisaDibatalkan,
  prasyaratTerpenuhi,
  rolePrimer,
  statusAwal,
  STATUS_HIDUP,
} from "./usulan-rules";

export type Aktor = { username: string; idUser: bigint; roles: string[]; scope: Scope };
export type UsulanInput = z.output<typeof usulanSchema>;

const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const invalid = (field: string, msg: string) =>
  new AppError("INVALID", 422, msg, { [field]: [msg] });

/** Pegawai yang menjadi sasaran: pegawai biasa → dirinya sendiri; admin/pembina → pegawai dalam scope. */
async function pegawaiSasaran(aktor: Aktor, token: string | undefined) {
  if (aktor.scope.kind === "self") {
    const p = await db.pegawai.findFirst({ where: { idUser: aktor.idUser, deletedAt: null } });
    if (!p)
      throw new AppError(
        "INVALID",
        422,
        "Akun Anda belum terhubung ke data pegawai. Hubungi admin.",
      );
    return { pegawai: p, untukDiriSendiri: true };
  }
  if (!token) throw invalid("pegawai", "Pilih pegawai terlebih dahulu.");
  const id = ids().decode("pegawai", token);
  const p =
    id === null
      ? null
      : await db.pegawai.findFirst({
          where: { id, deletedAt: null, ...pegawaiScope(aktor.scope) },
        });
  if (!p) throw invalid("pegawai", "Pegawai tidak ditemukan.");
  const sendiri = p.idUser !== null && p.idUser === aktor.idUser;
  return { pegawai: p, untukDiriSendiri: sendiri };
}

/** Penempatan aktif lengkap (JF + jenjang) — dasar kelayakan pelatihan, sama seperti Learning Path. */
async function penempatanAktif(idPegawai: bigint) {
  const pen = await db.pegawaiPenempatan.findFirst({
    where: { idPegawai, tglSelesai: null },
    orderBy: { tglMulai: "desc" },
  });
  if (!pen?.idJf || !pen.idJenjang) {
    throw new AppError(
      "INVALID",
      422,
      "Pegawai belum memiliki penempatan aktif dengan jabatan fungsional dan jenjang.",
    );
  }
  return { idJf: pen.idJf, idJenjang: pen.idJenjang };
}

export type FormUsulan =
  | { state: "perlu_pegawai" } // admin belum memilih pegawai
  | { state: "tidak_ada_pegawai" } // akun belum terhubung ke pegawai
  | { state: "belum_penempatan"; pegawai: { nama: string; nip: string } }
  | {
      state: "ok";
      pegawai: { token: string; nama: string; nip: string };
      untukDiriSendiri: boolean;
      pilihan: { token: string; label: string }[];
    };

/** Pelatihan yang layak diusulkan untuk satu pegawai: aktif, program di JF-nya, prasyarat jenjang terpenuhi, belum ada usulan hidup. */
export async function loadFormUsulan(
  aktor: Aktor,
  pegawaiToken: string | undefined,
): Promise<FormUsulan> {
  let sasaran;
  try {
    if (aktor.scope.kind !== "self" && !pegawaiToken) return { state: "perlu_pegawai" };
    sasaran = await pegawaiSasaran(aktor, pegawaiToken);
  } catch (e) {
    if (e instanceof AppError && aktor.scope.kind === "self") return { state: "tidak_ada_pegawai" };
    if (e instanceof AppError) throw NOT_FOUND();
    throw e;
  }
  const { pegawai } = sasaran;
  const pen = await db.pegawaiPenempatan.findFirst({
    where: { idPegawai: pegawai.id, tglSelesai: null },
    orderBy: { tglMulai: "desc" },
  });
  if (!pen?.idJf || !pen.idJenjang)
    return { state: "belum_penempatan", pegawai: { nama: pegawai.nama, nip: pegawai.nip } };

  const [pelatihan, hidup] = await Promise.all([
    db.pelatihan.findMany({
      where: {
        deletedAt: null,
        statusAktif: true,
        program: { idJf: pen.idJf, deletedAt: null, statusAktif: true },
      },
      orderBy: { namaPelatihan: "asc" },
      select: { id: true, namaPelatihan: true, jenjang: { select: { idJenjang: true } } },
    }),
    db.pelatihanUsulan
      .findMany({
        where: { idPegawai: pegawai.id, statusUsulan: { in: STATUS_HIDUP } },
        select: { idPelatihan: true },
      })
      .then((r) => new Set(r.map((x) => x.idPelatihan))),
  ]);
  const idJenjang = pen.idJenjang;
  return {
    state: "ok",
    pegawai: { token: ids().encode("pegawai", pegawai.id), nama: pegawai.nama, nip: pegawai.nip },
    untukDiriSendiri: sasaran.untukDiriSendiri,
    pilihan: pelatihan
      .filter(
        (p) =>
          !hidup.has(p.id) &&
          prasyaratTerpenuhi(
            idJenjang,
            p.jenjang.map((j) => j.idJenjang),
          ),
      )
      .map((p) => ({ token: ids().encode("pelatihan", p.id), label: p.namaPelatihan })),
  };
}

export async function createUsulan(input: UsulanInput, aktor: Aktor): Promise<{ token: string }> {
  const { pegawai, untukDiriSendiri } = await pegawaiSasaran(aktor, input.pegawai);
  const idPelatihan = ids().decode("pelatihan", input.pelatihan);
  const pel =
    idPelatihan === null
      ? null
      : await db.pelatihan.findFirst({
          where: { id: idPelatihan, deletedAt: null, statusAktif: true },
          select: {
            id: true,
            program: { select: { idJf: true } },
            jenjang: { select: { idJenjang: true } },
          },
        });
  if (!pel) throw invalid("pelatihan", "Pelatihan tidak ditemukan.");

  const pen = await penempatanAktif(pegawai.id);
  if (pel.program.idJf !== pen.idJf)
    throw invalid("pelatihan", "Pelatihan ini bukan untuk jabatan fungsional pegawai.");
  if (
    !prasyaratTerpenuhi(
      pen.idJenjang,
      pel.jenjang.map((j) => j.idJenjang),
    )
  ) {
    throw invalid("pelatihan", "Jenjang pegawai tidak memenuhi prasyarat pelatihan ini.");
  }

  const ada = await db.pelatihanUsulan.findFirst({
    where: { idPegawai: pegawai.id, idPelatihan: pel.id, statusUsulan: { in: STATUS_HIDUP } },
    select: { statusUsulan: true },
  });
  if (ada)
    throw new AppError(
      "CONFLICT",
      409,
      `Usulan untuk pelatihan ini sudah ada (status: ${ada.statusUsulan}).`,
    );

  const role = rolePrimer(aktor.roles);
  let row;
  try {
    row = await db.pelatihanUsulan.create({
      data: {
        idPegawai: pegawai.id,
        idPelatihan: pel.id,
        statusUsulan: statusAwal(untukDiriSendiri),
        diusulkanOleh: aktor.username.slice(0, 150),
        diusulkanOlehRole: role,
        alasanUsulan: input.alasan ?? null,
        createdBy: aktor.username,
      },
    });
  } catch (e) {
    // Balapan dua permintaan: indeks parsial uq_usulan_aktif menolak yang kedua.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("CONFLICT", 409, "Usulan untuk pelatihan ini sudah ada.");
    }
    throw e;
  }
  await audit("usulan.create", {
    entitas: "PelatihanUsulan",
    entitasId: String(row.id),
    actor: aktor.username,
    ...(role ? { actorRole: role } : {}),
  });
  return { token: ids().encode("usulan", row.id) };
}

/** Batalkan usulan yang belum diputuskan. Di luar scope → 404 (anti-IDOR). */
export async function batalkanUsulan(token: string, aktor: Aktor): Promise<void> {
  const id = decodeOr404("usulan", token);
  const pegawaiWhere: Prisma.PegawaiWhereInput =
    aktor.scope.kind === "self" ? { idUser: aktor.idUser } : pegawaiScope(aktor.scope);
  const u = await db.pelatihanUsulan.findFirst({
    where: { id, pegawai: { is: { deletedAt: null, ...pegawaiWhere } } },
    select: { id: true, statusUsulan: true },
  });
  if (!u) throw NOT_FOUND();
  if (!bisaDibatalkan(u.statusUsulan))
    throw new AppError(
      "CONFLICT",
      409,
      `Usulan berstatus "${u.statusUsulan}" tidak dapat dibatalkan.`,
    );

  // Atomik: hanya berhasil bila status masih bisa dibatalkan saat UPDATE (cegah balapan dengan persetujuan).
  const r = await db.pelatihanUsulan.updateMany({
    where: { id: u.id, statusUsulan: { in: ["mengusulkan", "diajukan"] } },
    data: { statusUsulan: "dibatalkan", updatedBy: aktor.username },
  });
  if (r.count === 0)
    throw new AppError("CONFLICT", 409, "Status usulan sudah berubah; muat ulang halaman.");
  const role = rolePrimer(aktor.roles);
  await audit("usulan.batal", {
    entitas: "PelatihanUsulan",
    entitasId: String(u.id),
    actor: aktor.username,
    ...(role ? { actorRole: role } : {}),
  });
}

export type UsulanRow = {
  token: string;
  pegawai: string;
  nip: string;
  pelatihan: string;
  tanggal: Date;
  status: string;
  oleh: string;
  alasan: string | null;
  alasanPenolakan: string | null;
  unitOrganisasi: string;
  unitKerja: string;
  jabatan: string;
  batchJadwal: string | null;
  bisaBatal: boolean;
  /** Sudah punya peserta batch (kursi terpakai). */
  punyaPeserta: boolean;
  /** Batch terbuka untuk pelatihan ini (untuk dialog persetujuan / daftar ke batch). */
  batchPilihan: { token: string; label: string }[];
};

export async function listUsulan(
  aktor: Aktor,
  opts: {
    page: number;
    q?: string | undefined;
    status?: string | undefined;
    withBatch?: boolean;
    f?: Filters;
  },
) {
  const pegawaiWhere: Prisma.PegawaiWhereInput =
    aktor.scope.kind === "self" ? { idUser: aktor.idUser } : pegawaiScope(aktor.scope);
  const where: Prisma.PelatihanUsulanWhereInput = {
    pegawai: { is: { deletedAt: null, ...pegawaiWhere } },
    statusUsulan: { in: ["mengusulkan", "diajukan"] },
    AND: andOf<Prisma.PelatihanUsulanWhereInput>([
      opts.f?.pegawai && {
        pegawai: { is: { OR: [{ nama: ci(opts.f.pegawai) }, { nip: ci(opts.f.pegawai) }] } },
      },
      opts.f?.pelatihan && { pelatihan: { is: { namaPelatihan: ci(opts.f.pelatihan) } } },
      opts.f?.status && { statusUsulan: opts.f.status },
      opts.f?.oleh && { diusulkanOleh: ci(opts.f.oleh) },
    ]),
    ...(opts.q
      ? {
          OR: [
            { pegawai: { is: { nama: { contains: opts.q, mode: "insensitive" } } } },
            { pegawai: { is: { nip: { contains: opts.q } } } },
            { pelatihan: { is: { namaPelatihan: { contains: opts.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.pelatihanUsulan.count({ where }),
    db.pelatihanUsulan.findMany({
      where,
      orderBy: { id: "desc" },
      skip: skip(opts.page),
      take: PAGE_SIZE,
      include: {
        pegawai: {
          select: {
            nama: true,
            nip: true,
            penempatan: {
              where: { tglSelesai: null },
              orderBy: { tglMulai: "desc" },
              take: 1,
              select: {
                unitOrganisasi: { select: { nama: true } },
                unitKerja: { select: { nama: true } },
                jf: { select: { namaJf: true } },
                jenjang: { select: { nama: true } },
              },
            },
          },
        },
        pelatihan: { select: { namaPelatihan: true } },
        peserta: { select: { id: true }, take: 1 },
      },
    }),
  ]);
  const batchMap = opts.withBatch
    ? await batchTerbukaPerPelatihan(aktor, [
        ...new Set(
          rows
            .filter(
              (r) =>
                r.statusUsulan === "mengusulkan" ||
                r.statusUsulan === "diajukan" ||
                r.statusUsulan === "disetujui",
            )
            .map((r) => r.idPelatihan),
        ),
      ])
    : new Map<string, { token: string; label: string }[]>();
  const data: UsulanRow[] = rows.map((r) => ({
    token: ids().encode("usulan", r.id),
    pegawai: r.pegawai.nama,
    nip: r.pegawai.nip,
    unitOrganisasi: r.pegawai.penempatan[0]?.unitOrganisasi?.nama ?? "-",
    unitKerja: r.pegawai.penempatan[0]?.unitKerja?.nama ?? "-",
    jabatan:
      [r.pegawai.penempatan[0]?.jf?.namaJf, r.pegawai.penempatan[0]?.jenjang?.nama]
        .filter(Boolean)
        .join(" / ") || "-",
    batchJadwal: batchMap.get(String(r.idPelatihan))?.[0]?.label ?? null,
    pelatihan: r.pelatihan.namaPelatihan,
    tanggal: r.tanggalUsulan,
    status: r.statusUsulan,
    oleh: r.diusulkanOleh,
    alasan: r.alasanUsulan,
    alasanPenolakan: r.alasanPenolakan,
    bisaBatal: bisaDibatalkan(r.statusUsulan),
    punyaPeserta: r.peserta.length > 0,
    batchPilihan: batchMap.get(String(r.idPelatihan)) ?? [],
  }));
  return { total, rows: data };
}
