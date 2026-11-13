import type { Prisma } from "@prisma/client";
import { RUMPUN_LABEL } from "@/lib/schemas/master";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { jfOptions } from "./master/jf";
import { decodeOr404 } from "./master/shared";
import { buildMatriks, type MatriksData } from "./matriks-build";

export type MatriksView = {
  options: { value: string; label: string }[];
  selected: string | null; // token JF terpilih
  data: MatriksData | null;
  multiRumpun: boolean;
};

/**
 * Matriks per JF. Hanya JF dalam scope yang bisa dibuka (token JF instansi lain = 404, bukan data kosong).
 * Kolom = jenjang aktif pada rumpun yang dipakai JF tsb (dari pelatihan atau penempatan pegawai);
 * bila belum ada jejaknya, semua jenjang aktif ditampilkan.
 */
export async function loadMatriks(scope: Scope, jfToken: string | undefined): Promise<MatriksView> {
  const options = await jfOptions(scope);
  const selected = jfToken ?? options[0]?.value ?? null;
  if (!selected) return { options, selected: null, data: null, multiRumpun: false };

  // Token harus ada di opsi yang boleh dilihat aktor (sekaligus validasi scope).
  decodeOr404("jf", selected);
  if (!options.some((o) => o.value === selected)) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  const idJf = decodeOr404("jf", selected);

  const rumpunRows = await db.jenjangJabatan.findMany({
    where: { OR: [{ pelatihan: { some: { pelatihan: { program: { idJf } } } } }, { penempatan: { some: { idJf } } }] },
    select: { rumpun: true },
    distinct: ["rumpun"],
  });
  const rumpun = rumpunRows.map((r) => r.rumpun);
  const jenjangWhere: Prisma.JenjangJabatanWhereInput = { statusAktif: true, ...(rumpun.length ? { rumpun: { in: rumpun } } : {}) };

  const [kompetensi, jenjang, pelatihan] = await Promise.all([
    db.kompetensi.findMany({
      where: { idJf, statusAktif: true },
      include: { detail: { include: { jenis: true } } },
      orderBy: [{ detail: { jenis: { namaJenis: "asc" } } }, { detail: { namaDetail: "asc" } }, { namaKompetensi: "asc" }],
    }),
    db.jenjangJabatan.findMany({ where: jenjangWhere, orderBy: [{ rumpun: "asc" }, { urutan: "asc" }, { nama: "asc" }] }),
    db.pelatihan.findMany({
      where: { statusAktif: true, program: { idJf, statusAktif: true } },
      select: {
        id: true,
        namaPelatihan: true,
        kategoriPelatihan: true,
        isSertifikat: true,
        kompetensi: { select: { idKompetensi: true } },
        jenjang: { select: { idJenjang: true } },
      },
    }),
  ]);

  const data = buildMatriks(
    kompetensi.map((k) => ({ id: k.id, nama: k.namaKompetensi, jenis: k.detail.jenis.namaJenis, subJenis: k.detail.namaDetail })),
    jenjang.map((j) => ({ id: j.id, nama: j.nama, rumpun: RUMPUN_LABEL[j.rumpun] })),
    pelatihan.map((p) => ({
      id: p.id,
      nama: p.namaPelatihan,
      kategori: p.kategoriPelatihan,
      sertifikat: p.isSertifikat,
      kompetensi: p.kompetensi.map((x) => x.idKompetensi),
      jenjang: p.jenjang.map((x) => x.idJenjang),
    })),
  );
  return { options, selected, data, multiRumpun: new Set(jenjang.map((j) => j.rumpun)).size > 1 };
}

