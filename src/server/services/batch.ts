import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import { KEHADIRAN, type BatchInput } from "@/lib/schemas/batch";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { viaJfScope } from "./master/refs";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./master/shared";
import { KURSI_TERPAKAI } from "./batch-rules";

/** Batch dimiliki lewat pelatihan → program → JF → instansi (sama dengan pelatihan). */
export function batchScope(scope: Scope): Prisma.PelatihanBatchWhereInput {
  return { pelatihan: { program: viaJfScope(scope) as Prisma.ProgramBangkomWhereInput } };
}
const NOT_FOUND = () => new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
const invalid = (field: string, msg: string) =>
  new AppError("INVALID", 422, msg, { [field]: [msg] });
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export type BatchRow = {
  id: string;
  pelatihan: string; // token
  pelatihanNama: string;
  penyelenggara: string; // token atau ""
  penyelenggaraNama: string;
  tahunPelaksanaan: number;
  angkatan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  kapasitas: number;
  terisi: number;
  statusBatch: string;
  keterangan: string;
  statusAktif: boolean;
};

export async function listBatch(
  scope: Scope,
  q: string | undefined,
  page: number,
  f: Filters = {},
) {
  const where: Prisma.PelatihanBatchWhereInput = {
    ...batchScope(scope),
    AND: andOf<Prisma.PelatihanBatchWhereInput>([
      f.pelatihan && { pelatihan: { namaPelatihan: ci(f.pelatihan) } },
      f.penyelenggara && { penyelenggara: { nama: ci(f.penyelenggara) } },
      fInt(f.tahun) !== undefined && { tahunPelaksanaan: fInt(f.tahun) as number },
      f.angkatan && { angkatan: ci(f.angkatan) },
      f.status_batch && { statusBatch: f.status_batch },
      fAktif(f.status) !== undefined && { statusAktif: fAktif(f.status) as boolean },
    ]),
    ...(q
      ? {
          OR: [
            { pelatihan: { namaPelatihan: { contains: q, mode: "insensitive" } } },
            { angkatan: { contains: q, mode: "insensitive" } },
            { penyelenggara: { nama: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.pelatihanBatch.findMany({
      where,
      orderBy: [{ tanggalMulai: "desc" }, { id: "desc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: {
        pelatihan: { select: { namaPelatihan: true } },
        penyelenggara: { select: { nama: true } },
        _count: { select: { peserta: { where: KURSI_TERPAKAI } } },
      },
    }),
    db.pelatihanBatch.count({ where }),
  ]);
  const data: BatchRow[] = rows.map((r) => ({
    id: ids().encode("batch", r.id),
    pelatihan: ids().encode("pelatihan", r.idPelatihan),
    pelatihanNama: r.pelatihan.namaPelatihan,
    penyelenggara: r.idPenyelenggara ? ids().encode("penyelenggara", r.idPenyelenggara) : "",
    penyelenggaraNama: r.penyelenggara?.nama ?? "—",
    tahunPelaksanaan: r.tahunPelaksanaan,
    angkatan: r.angkatan,
    tanggalMulai: ymd(r.tanggalMulai),
    tanggalSelesai: ymd(r.tanggalSelesai),
    kapasitas: r.kapasitas,
    terisi: r._count.peserta,
    statusBatch: r.statusBatch,
    keterangan: r.keterangan ?? "",
    statusAktif: r.statusAktif,
  }));
  return { rows: data, total };
}

export async function batchFormOptions(scope: Scope) {
  const [pelatihan, penyelenggara] = await Promise.all([
    db.pelatihan.findMany({
      where: {
        deletedAt: null,
        statusAktif: true,
        program: viaJfScope(scope) as Prisma.ProgramBangkomWhereInput,
      },
      orderBy: { namaPelatihan: "asc" },
      select: {
        id: true,
        namaPelatihan: true,
        program: { select: { jf: { select: { namaJf: true } } } },
      },
    }),
    db.penyelenggara.findMany({
      where: { deletedAt: null, statusAktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ]);
  return {
    pelatihan: pelatihan.map((p) => ({
      value: ids().encode("pelatihan", p.id),
      label: `${p.namaPelatihan} — ${p.program.jf.namaJf}`,
    })),
    penyelenggara: penyelenggara.map((p) => ({
      value: ids().encode("penyelenggara", p.id),
      label: p.nama,
    })),
  };
}

async function resolveRefs(input: BatchInput, scope: Scope) {
  const idPelatihan = ids().decode("pelatihan", input.pelatihan);
  const pel =
    idPelatihan === null
      ? null
      : await db.pelatihan.findFirst({
          where: {
            id: idPelatihan,
            deletedAt: null,
            program: viaJfScope(scope) as Prisma.ProgramBangkomWhereInput,
          },
          select: { id: true },
        });
  if (!pel) throw invalid("pelatihan", "Pelatihan tidak valid.");
  let idPenyelenggara: bigint | null = null;
  if (input.penyelenggara) {
    const id = ids().decode("penyelenggara", input.penyelenggara);
    const p =
      id === null
        ? null
        : await db.penyelenggara.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          });
    if (!p) throw invalid("penyelenggara", "Penyelenggara tidak valid.");
    idPenyelenggara = p.id;
  }
  return { idPelatihan: pel.id, idPenyelenggara };
}

async function assertUnik(idPelatihan: bigint, input: BatchInput, exceptId?: bigint) {
  const dup = await db.pelatihanBatch.findFirst({
    where: {
      idPelatihan,
      tahunPelaksanaan: input.tahunPelaksanaan,
      angkatan: input.angkatan,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup)
    throw new AppError(
      "CONFLICT",
      409,
      "Batch dengan pelatihan, tahun, dan angkatan yang sama sudah ada.",
      { angkatan: ["Sudah dipakai"] },
    );
}

export async function createBatch(input: BatchInput, actor: string, scope: Scope) {
  const { idPelatihan, idPenyelenggara } = await resolveRefs(input, scope);
  await assertUnik(idPelatihan, input);
  const row = await db.pelatihanBatch.create({
    data: {
      idPelatihan,
      idPenyelenggara,
      tahunPelaksanaan: input.tahunPelaksanaan,
      angkatan: input.angkatan,
      tanggalMulai: toDate(input.tanggalMulai),
      tanggalSelesai: toDate(input.tanggalSelesai),
      kapasitas: input.kapasitas,
      statusBatch: input.statusBatch,
      keterangan: input.keterangan ?? null,
      statusAktif: input.statusAktif,
      createdBy: actor,
    },
  });
  await audit("create", { entitas: "PelatihanBatch", entitasId: String(row.id), actor });
  return { id: ids().encode("batch", row.id) };
}

export async function updateBatch(token: string, input: BatchInput, actor: string, scope: Scope) {
  const id = decodeOr404("batch", token);
  const cur = await db.pelatihanBatch.findFirst({
    where: { id, ...batchScope(scope) },
    select: { id: true, idPelatihan: true },
  });
  if (!cur) throw NOT_FOUND();
  const { idPelatihan, idPenyelenggara } = await resolveRefs(input, scope);
  const terisi = await db.pelatihanPesertaBatch.count({
    where: { idBatch: id, ...KURSI_TERPAKAI },
  });
  const total = await db.pelatihanPesertaBatch.count({ where: { idBatch: id } });
  if (idPelatihan !== cur.idPelatihan && total > 0)
    throw invalid("pelatihan", "Pelatihan tidak dapat diubah karena batch sudah memiliki peserta.");
  if (input.kapasitas > 0 && input.kapasitas < terisi)
    throw invalid(
      "kapasitas",
      `Kapasitas tidak boleh di bawah jumlah peserta saat ini (${terisi}).`,
    );
  await assertUnik(idPelatihan, input, id);
  await db.pelatihanBatch.update({
    where: { id },
    data: {
      idPelatihan,
      idPenyelenggara,
      tahunPelaksanaan: input.tahunPelaksanaan,
      angkatan: input.angkatan,
      tanggalMulai: toDate(input.tanggalMulai),
      tanggalSelesai: toDate(input.tanggalSelesai),
      kapasitas: input.kapasitas,
      statusBatch: input.statusBatch,
      keterangan: input.keterangan ?? null,
      statusAktif: input.statusAktif,
      updatedBy: actor,
    },
  });
  await audit("update", { entitas: "PelatihanBatch", entitasId: String(id), actor });
}

export async function removeBatch(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("batch", token);
  const cur = await db.pelatihanBatch.findFirst({
    where: { id, ...batchScope(scope) },
    select: { id: true },
  });
  if (!cur) throw NOT_FOUND();
  conflictIfUsed("Batch", [
    ["peserta", await db.pelatihanPesertaBatch.count({ where: { idBatch: id } })],
  ]);
  await db.pelatihanBatch.delete({ where: { id } });
  await audit("delete", { entitas: "PelatihanBatch", entitasId: String(id), actor });
}

// ---------- Detail & peserta ----------
export async function detailBatch(scope: Scope, token: string) {
  const id = decodeOr404("batch", token);
  const b = await db.pelatihanBatch.findFirst({
    where: { id, ...batchScope(scope) },
    include: {
      pelatihan: { select: { namaPelatihan: true } },
      penyelenggara: { select: { nama: true } },
      peserta: {
        orderBy: { id: "asc" },
        include: {
          pegawai: {
            select: {
              nama: true,
              nip: true,
              penempatan: {
                where: { tglSelesai: null },
                take: 1,
                select: { jenjang: { select: { nama: true } } },
              },
            },
          },
          usulan: { select: { statusUsulan: true, diusulkanOleh: true, tanggalUsulan: true } },
        },
      },
    },
  });
  if (!b) throw NOT_FOUND();
  const terisi = b.peserta.filter((p) => p.statusAktif).length;
  return {
    token,
    pelatihan: b.pelatihan.namaPelatihan,
    penyelenggara: b.penyelenggara?.nama ?? "—",
    tahun: b.tahunPelaksanaan,
    angkatan: b.angkatan,
    mulai: ymd(b.tanggalMulai),
    selesai: ymd(b.tanggalSelesai),
    kapasitas: b.kapasitas,
    terisi,
    status: b.statusBatch,
    peserta: b.peserta.map((p) => ({
      token: ids().encode("peserta", p.id),
      nama: p.pegawai.nama,
      nip: p.pegawai.nip,
      jenjang: p.pegawai.penempatan[0]?.jenjang?.nama ?? "—",
      kehadiran: p.statusKehadiran,
      nilaiAkhir: p.nilaiAkhir === null ? "—" : p.nilaiAkhir.toString(),
      statusLulus: p.statusLulus ?? "—",
      statusUsulan: p.usulan?.statusUsulan ?? "—",
      diusulkanOleh: p.usulan?.diusulkanOleh ?? "—",
      tanggalUsulan: p.usulan ? ymd(p.usulan.tanggalUsulan) : "—",
    })),
  };
}

async function pesertaDalamScope(token: string, scope: Scope) {
  const id = decodeOr404("peserta", token);
  const p = await db.pelatihanPesertaBatch.findFirst({
    where: { id, batch: batchScope(scope) },
    select: { id: true, idBatch: true, statusKehadiran: true },
  });
  if (!p) throw NOT_FOUND();
  return p;
}

export async function setKehadiran(token: string, status: string, actor: string, scope: Scope) {
  if (!(KEHADIRAN as readonly string[]).includes(status))
    throw invalid("status", "Status tidak valid.");
  const p = await pesertaDalamScope(token, scope);
  await db.pelatihanPesertaBatch.update({
    where: { id: p.id },
    data: { statusKehadiran: status, updatedBy: actor },
  });
  await audit("peserta.kehadiran", {
    entitas: "PelatihanPesertaBatch",
    entitasId: String(p.id),
    actor,
    meta: { status },
  });
}

/** Mengeluarkan peserta hanya selama masih "terdaftar" (belum hadir/selesai) agar riwayat pelatihan tidak hilang. */
export async function keluarkanPeserta(token: string, actor: string, scope: Scope) {
  const p = await pesertaDalamScope(token, scope);
  if (p.statusKehadiran !== "terdaftar")
    throw new AppError(
      "CONFLICT",
      409,
      "Peserta yang sudah hadir/selesai tidak dapat dikeluarkan.",
    );
  await db.pelatihanPesertaBatch.delete({ where: { id: p.id } });
  await audit("peserta.keluar", {
    entitas: "PelatihanPesertaBatch",
    entitasId: String(p.id),
    actor,
  });
}
