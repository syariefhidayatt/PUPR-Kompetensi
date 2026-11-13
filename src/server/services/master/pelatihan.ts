import { andOf, ci, fAktif, fEnum, fInt, fYa, type Filters } from "@/lib/filters";
import type { Prisma } from "@prisma/client";
import type { PelatihanFormOptions, PelatihanRow } from "@/components/pelatihan/types";
import { RUMPUN_LABEL, type PelatihanInput } from "@/lib/schemas/master";
import { audit } from "@/server/audit";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids, type IdKind } from "@/server/ids";
import { viaJfScope } from "./refs";
import { PAGE_SIZE, conflictIfUsed, decodeOr404, skip } from "./shared";

const scopeWhere = (scope: Scope) => ({ program: viaJfScope(scope) }) as Prisma.PelatihanWhereInput;
const programScope = (scope: Scope) => viaJfScope(scope) as Prisma.ProgramBangkomWhereInput;

export type StatusFilter = "aktif" | "nonaktif" | undefined;

export async function listPelatihan(scope: Scope, q: string | undefined, status: StatusFilter, page: number, f: Filters = {}) {
  const where: Prisma.PelatihanWhereInput = {
    ...scopeWhere(scope),
    ...(status ? { statusAktif: status === "aktif" } : {}),
    AND: andOf<Prisma.PelatihanWhereInput>([
      f.instansi && { program: { jf: { instansi: { nama: ci(f.instansi) } } } },
      f.jf && { program: { jf: { namaJf: ci(f.jf) } } },
      f.program && { program: { namaProgram: ci(f.program) } },
      f.nama && { namaPelatihan: ci(f.nama) },
      f.jenis && { jenisPelatihan: ci(f.jenis) },
      f.kategori && { kategoriPelatihan: ci(f.kategori) },
      fYa(f.sertifikat) !== undefined && { isSertifikat: fYa(f.sertifikat) as boolean },
      fYa(f.refreshment) !== undefined && { isRefreshment: fYa(f.refreshment) as boolean },
      fAktif(f.status_aktif) !== undefined && { statusAktif: fAktif(f.status_aktif) as boolean },
    ]),
    ...(q
      ? {
          OR: [
            { namaPelatihan: { contains: q, mode: "insensitive" } },
            { program: { namaProgram: { contains: q, mode: "insensitive" } } },
            { program: { jf: { namaJf: { contains: q, mode: "insensitive" } } } },
            { program: { jf: { instansi: { nama: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.pelatihan.findMany({
      where,
      orderBy: [{ program: { jf: { namaJf: "asc" } } }, { namaPelatihan: "asc" }],
      skip: skip(page),
      take: PAGE_SIZE,
      include: {
        program: { include: { jf: { include: { instansi: { select: { nama: true } } } } } },
        jenjang: { include: { jenjang: true } },
        kompetensi: { include: { kompetensi: true } },
        sertifikasi: true,
      },
    }),
    db.pelatihan.count({ where }),
  ]);
  const data: PelatihanRow[] = rows.map((r) => {
    const jenjang = [...r.jenjang].sort((a, b) => a.jenjang.rumpun.localeCompare(b.jenjang.rumpun) || a.jenjang.urutan - b.jenjang.urutan);
    return {
      id: ids().encode("pelatihan", r.id),
      program: ids().encode("program", r.idProgram),
      programLabel: `${r.program.namaProgram} — ${r.program.jf.namaJf} (${r.program.jf.instansi.nama})`,
      namaPelatihan: r.namaPelatihan,
      deskripsi: r.deskripsi ?? "",
      jenisPelatihan: r.jenisPelatihan ?? "",
      kategoriPelatihan: r.kategoriPelatihan ?? "",
      isPeriode: r.isPeriode,
      kPeriode: r.kPeriode,
      isRefreshment: r.isRefreshment,
      kRefreshment: r.kRefreshment,
      dibukaLagi: r.kPeriode !== null && r.kRefreshment !== null ? r.kPeriode + r.kRefreshment : null,
      isSertifikat: r.isSertifikat,
      statusAktif: r.statusAktif,
      jenjang: jenjang.map((j) => ids().encode("jenjang", j.idJenjang)),
      jenjangLabels: jenjang.map((j) => j.jenjang.nama),
      kompetensi: r.kompetensi.map((k) => ({ value: ids().encode("kompetensi", k.idKompetensi), label: k.kompetensi.namaKompetensi })),
      sertifikasi: r.sertifikasi.map((s) => ids().encode("sertifikasi", s.idSertifikasi)),
    };
  });
  return { rows: data, total };
}

/** Opsi form. Kompetensi per program = aktif, satu JF & satu sub jenis dengan program (L6). */
export async function pelatihanFormOptions(scope: Scope): Promise<PelatihanFormOptions> {
  const [programs, kompetensi, jenjang, sertifikasi] = await Promise.all([
    db.programBangkom.findMany({
      where: programScope(scope),
      orderBy: [{ jf: { namaJf: "asc" } }, { namaProgram: "asc" }],
      select: { id: true, idJf: true, idJenisDetail: true, namaProgram: true, statusAktif: true, jf: { select: { namaJf: true, instansi: { select: { nama: true } } } } },
    }),
    db.kompetensi.findMany({
      where: { statusAktif: true, ...(viaJfScope(scope) as Prisma.KompetensiWhereInput) },
      orderBy: { namaKompetensi: "asc" },
      select: { id: true, idJf: true, idJenisDetail: true, namaKompetensi: true },
    }),
    db.jenjangJabatan.findMany({ orderBy: [{ rumpun: "asc" }, { urutan: "asc" }, { nama: "asc" }] }),
    db.sertifikasi.findMany({ orderBy: { nama: "asc" } }),
  ]);
  const byKey = new Map<string, { value: string; label: string }[]>();
  for (const k of kompetensi) {
    const key = `${k.idJf}:${k.idJenisDetail}`;
    const list = byKey.get(key) ?? [];
    list.push({ value: ids().encode("kompetensi", k.id), label: k.namaKompetensi });
    byKey.set(key, list);
  }
  return {
    programs: programs.map((p) => ({
      value: ids().encode("program", p.id),
      label: `${p.namaProgram} — ${p.jf.namaJf} (${p.jf.instansi.nama})${p.statusAktif ? "" : " (nonaktif)"}`,
      kompetensi: byKey.get(`${p.idJf}:${p.idJenisDetail}`) ?? [],
    })),
    jenjang: jenjang.map((j) => ({ value: ids().encode("jenjang", j.id), label: `${j.nama} (${RUMPUN_LABEL[j.rumpun]})${j.statusAktif ? "" : " (nonaktif)"}` })),
    sertifikasi: sertifikasi.map((s) => ({ value: ids().encode("sertifikasi", s.id), label: s.statusAktif ? s.nama : `${s.nama} (nonaktif)` })),
  };
}

function decodeAll(kind: IdKind, tokens: string[], field: string): bigint[] {
  const out: bigint[] = [];
  for (const t of tokens) {
    const id = ids().decode(kind, t);
    if (id === null) throw new AppError("INVALID", 422, "Pilihan tidak valid.", { [field]: ["Ada pilihan yang tidak valid"] });
    out.push(id);
  }
  return out;
}

type Existing = { idProgram: bigint; kompetensiIds: Set<bigint> };

/** Memvalidasi semua referensi di server (jangan percaya form) dan mengembalikan id mentah. */
async function resolveRefs(input: PelatihanInput, scope: Scope, existing?: Existing) {
  const idProgram = decodeOr404("program", input.program);
  const program = await db.programBangkom.findFirst({
    where: { id: idProgram, ...programScope(scope) },
    select: { id: true, idJf: true, idJenisDetail: true, statusAktif: true },
  });
  if (!program) throw new AppError("INVALID", 422, "Program tidak valid.", { program: ["Program tidak valid"] });
  // Program nonaktif hanya boleh dipertahankan oleh pelatihan yang sudah memakainya.
  if (!program.statusAktif && existing?.idProgram !== program.id) {
    throw new AppError("INVALID", 422, "Program nonaktif.", { program: ["Program tidak aktif"] });
  }

  const idJenjang = decodeAll("jenjang", input.jenjang, "jenjang");
  const idSertifikasi = decodeAll("sertifikasi", input.sertifikasi, "sertifikasi");
  const idKompetensi = decodeAll("kompetensi", input.kompetensi, "kompetensi");

  const [nJenjang, nSert, komp] = await Promise.all([
    db.jenjangJabatan.count({ where: { id: { in: idJenjang } } }),
    db.sertifikasi.count({ where: { id: { in: idSertifikasi } } }),
    db.kompetensi.findMany({
      where: { id: { in: idKompetensi }, idJf: program.idJf, idJenisDetail: program.idJenisDetail },
      select: { id: true, statusAktif: true },
    }),
  ]);
  if (nJenjang !== idJenjang.length) throw new AppError("INVALID", 422, "Jenjang tidak valid.", { jenjang: ["Ada jenjang yang tidak valid"] });
  if (nSert !== idSertifikasi.length) throw new AppError("INVALID", 422, "Sertifikasi tidak valid.", { sertifikasi: ["Ada sertifikasi yang tidak valid"] });
  // Kompetensi harus milik JF + sub jenis program. Yang nonaktif hanya boleh bila sudah terhubung sebelumnya.
  const okKomp = komp.filter((k) => k.statusAktif || existing?.kompetensiIds.has(k.id));
  if (okKomp.length !== idKompetensi.length) {
    throw new AppError("INVALID", 422, "Kompetensi tidak sesuai program.", { kompetensi: ["Kompetensi harus aktif dan sesuai JF & sub jenis program"] });
  }
  return { idProgram, idJenjang, idSertifikasi, idKompetensi };
}

const scalar = (input: PelatihanInput) => ({
  namaPelatihan: input.namaPelatihan,
  deskripsi: input.deskripsi ?? null,
  jenisPelatihan: input.jenisPelatihan ?? null,
  kategoriPelatihan: input.kategoriPelatihan ?? null,
  isPeriode: input.isPeriode,
  kPeriode: input.kPeriode ?? null,
  isRefreshment: input.isRefreshment,
  kRefreshment: input.kRefreshment ?? null,
  isSertifikat: input.isSertifikat,
  statusAktif: input.statusAktif,
});

async function findInScope(id: bigint, scope: Scope) {
  const row = await db.pelatihan.findFirst({
    where: { id, ...scopeWhere(scope) },
    select: { id: true, idProgram: true, namaPelatihan: true, kompetensi: { select: { idKompetensi: true } } },
  });
  if (!row) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  return row;
}

export async function createPelatihan(input: PelatihanInput, actor: string, scope: Scope) {
  const r = await resolveRefs(input, scope);
  const row = await db.$transaction(async (tx) =>
    tx.pelatihan.create({
      data: {
        ...scalar(input),
        idProgram: r.idProgram,
        createdBy: actor,
        jenjang: { create: r.idJenjang.map((idJenjang) => ({ idJenjang })) },
        kompetensi: { create: r.idKompetensi.map((idKompetensi) => ({ idKompetensi })) },
        sertifikasi: { create: r.idSertifikasi.map((idSertifikasi) => ({ idSertifikasi })) },
      },
    }),
  );
  await audit("create", { entitas: "Pelatihan", entitasId: String(row.id), actor, meta: { nama: input.namaPelatihan } });
  return { id: ids().encode("pelatihan", row.id) };
}

export async function updatePelatihan(token: string, input: PelatihanInput, actor: string, scope: Scope) {
  const id = decodeOr404("pelatihan", token);
  const current = await findInScope(id, scope);
  const r = await resolveRefs(input, scope, {
    idProgram: current.idProgram,
    kompetensiIds: new Set(current.kompetensi.map((k) => k.idKompetensi)),
  });
  // Semua field + 3 pivot dalam satu transaksi (L4): tidak ada keadaan setengah tersimpan.
  await db.$transaction(async (tx) => {
    await tx.pelatihan.update({ where: { id }, data: { ...scalar(input), idProgram: r.idProgram, updatedBy: actor } });
    await tx.pelatihanJenjang.deleteMany({ where: { idPelatihan: id } });
    await tx.pelatihanKompetensi.deleteMany({ where: { idPelatihan: id } });
    await tx.pelatihanSertifikasi.deleteMany({ where: { idPelatihan: id } });
    await tx.pelatihanJenjang.createMany({ data: r.idJenjang.map((idJenjang) => ({ idPelatihan: id, idJenjang })) });
    await tx.pelatihanKompetensi.createMany({ data: r.idKompetensi.map((idKompetensi) => ({ idPelatihan: id, idKompetensi })) });
    await tx.pelatihanSertifikasi.createMany({ data: r.idSertifikasi.map((idSertifikasi) => ({ idPelatihan: id, idSertifikasi })) });
  });
  await audit("update", { entitas: "Pelatihan", entitasId: String(id), actor, meta: { nama: input.namaPelatihan } });
}

export async function removePelatihan(token: string, actor: string, scope: Scope) {
  const id = decodeOr404("pelatihan", token);
  const current = await findInScope(id, scope);
  // Pivot ikut terhapus (ON DELETE CASCADE). Batch & usulan menahan hapus: dicek eksplisit agar pesannya jelas.
  conflictIfUsed("Pelatihan", [
    ["batch", await db.pelatihanBatch.count({ where: { idPelatihan: id } })],
    ["usulan", await db.pelatihanUsulan.count({ where: { idPelatihan: id } })],
  ]);
  await db.pelatihan.delete({ where: { id } });
  await audit("delete", { entitas: "Pelatihan", entitasId: String(id), actor, meta: { nama: current.namaPelatihan } });
}
