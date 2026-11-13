import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ids } from "@/server/ids";
import { jfOptions } from "./master/jf";
import { decodeOr404 } from "./master/shared";
import { normalisasiTahun } from "./pengelolaan";
import { teksRefresh } from "./skema-calc";

export type SkemaRow = { token: string; pelatihan: string; program: string; jenis: string; kategori: string; jenjang: string[]; kompetensi: string[]; refreshment: string };
export type SkemaView = { options: { value: string; label: string }[]; selected: string | null; tahun: number; rows: SkemaRow[] };

/**
 * Skema pelatihan satu JF. Pelatihan berperiode hanya tampil pada tahun periodenya (kPeriode);
 * pelatihan tanpa periode selalu tampil. JF di luar scope = 404.
 */
export async function loadSkema(scope: Scope, opts: { jf?: string | undefined; tahun?: number | undefined }): Promise<SkemaView> {
  const tahun = normalisasiTahun(opts.tahun);
  const options = await jfOptions(scope);
  const selected = opts.jf ?? options[0]?.value ?? null;
  if (!selected) return { options, selected, tahun, rows: [] };
  const idJf = decodeOr404("jf", selected);
  if (!options.some((o) => o.value === selected)) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");

  const data = await db.pelatihan.findMany({
    where: {
      deletedAt: null,
      statusAktif: true,
      program: { idJf, statusAktif: true },
      OR: [{ isPeriode: false }, { kPeriode: null }, { kPeriode: tahun }],
    },
    orderBy: { namaPelatihan: "asc" },
    select: {
      id: true, namaPelatihan: true, jenisPelatihan: true, kategoriPelatihan: true, isRefreshment: true, kRefreshment: true,
      program: { select: { namaProgram: true } },
      jenjang: { select: { jenjang: { select: { nama: true, urutan: true } } } },
      kompetensi: { select: { kompetensi: { select: { namaKompetensi: true } } } },
    },
  });
  return {
    options, selected, tahun,
    rows: data.map((p) => ({
      token: ids().encode("pelatihan", p.id),
      pelatihan: p.namaPelatihan,
      program: p.program.namaProgram,
      jenis: p.jenisPelatihan ?? "",
      kategori: p.kategoriPelatihan ?? "",
      jenjang: p.jenjang.map((j) => j.jenjang).sort((a, b) => b.urutan - a.urutan).map((j) => j.nama),
      kompetensi: p.kompetensi.map((k) => k.kompetensi.namaKompetensi).sort((a, b) => a.localeCompare(b, "id")),
      refreshment: teksRefresh(p.isRefreshment, p.kRefreshment),
    })),
  };
}
