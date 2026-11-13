import { z } from "zod";

// Checkbox HTML: ada "on" bila dicentang, tidak ada sama sekali bila tidak.
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max: number) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const parseJson = (v: unknown) => {
  if (typeof v !== "string" || v === "") return [];
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return null; // gagal parse → ditolak validator array
  }
};
const nama = (min: number, max: number) =>
  z.string().trim().min(min, `Minimal ${min} karakter`).max(max, `Maksimal ${max} karakter`);

export const instansiSchema = z.object({
  nama: nama(3, 200),
  jenis: z.coerce.number({ message: "Pilih jenis" }).int().min(1, "Pilih jenis").max(4, "Pilih jenis"),
  statusAktif: bool,
});

export const jfSchema = z.object({
  instansi: z.string().trim().min(1, "Wajib dipilih"),
  kodeJf: optText(20),
  namaJf: nama(3, 200),
  statusAktif: bool,
});

export const RUMPUN_LABEL = { KEAHLIAN: "Keahlian", KETERAMPILAN: "Keterampilan" } as const;

export const jenjangSchema = z.object({
  nama: nama(2, 100),
  rumpun: z.enum(["KEAHLIAN", "KETERAMPILAN"], { message: "Wajib dipilih" }),
  urutan: z.coerce.number({ message: "Wajib diisi" }).int().min(1, "Minimal 1").max(99, "Maksimal 99"),
  statusAktif: bool,
});

export const kompetensiSchema = z.object({
  jf: z.string().trim().min(1, "Wajib dipilih"),
  jenisDetail: z.string().trim().min(1, "Wajib dipilih"),
  namaKompetensi: nama(3, 255),
  statusAktif: bool,
});

export const KATEGORI_PROGRAM = ["Wajib", "Pilihan"] as const;

export const programSchema = z.object({
  jf: z.string().trim().min(1, "Wajib dipilih"),
  jenisDetail: z.string().trim().min(1, "Wajib dipilih"),
  namaProgram: nama(3, 200),
  deskripsi: optText(2000),
  kategori: z.preprocess((v) => (v === "" ? undefined : v), z.enum(KATEGORI_PROGRAM, { message: "Pilih Wajib atau Pilihan" }).optional()),
  statusAktif: bool,
});

const tokenArray = (min: number, msg: string) =>
  z.preprocess(parseJson, z.array(z.string().trim().min(1)).max(200)).pipe(z.array(z.string()).min(min, msg));

const intField = (min: number, max: number, label: string) =>
  z.preprocess(emptyToUndef, z.coerce.number({ message: `${label} harus angka` }).int().min(min, `${label} minimal ${min}`).max(max, `${label} maksimal ${max}`).optional());

export const pelatihanSchema = z
  .object({
    program: z.string().trim().min(1, "Wajib dipilih"),
    namaPelatihan: nama(3, 500),
    deskripsi: optText(4000),
    jenisPelatihan: optText(100), // teks bebas (keputusan 10 Nov 2026)
    kategoriPelatihan: optText(100), // teks bebas
    isPeriode: bool,
    kPeriode: intField(2000, 2100, "Tahun periode"),
    isRefreshment: bool,
    kRefreshment: intField(1, 10, "Interval refreshment"),
    isSertifikat: bool,
    statusAktif: bool,
    jenjang: tokenArray(1, "Pilih minimal satu jenjang"),
    kompetensi: tokenArray(1, "Pilih minimal satu kompetensi"),
    sertifikasi: tokenArray(0, ""),
  })
  .superRefine((v, ctx) => {
    if (v.isPeriode && v.kPeriode === undefined) ctx.addIssue({ code: "custom", path: ["kPeriode"], message: "Isi tahun periode" });
    if (v.isRefreshment && v.kRefreshment === undefined) ctx.addIssue({ code: "custom", path: ["kRefreshment"], message: "Isi interval refreshment (tahun)" });
    // Cron menghitung kPeriode + kRefreshment: tanpa periode, refreshment tidak akan pernah terbuka.
    if (v.isRefreshment && !v.isPeriode) ctx.addIssue({ code: "custom", path: ["kRefreshment"], message: "Refreshment memerlukan periode (aktifkan Periode dulu)" });
    if (v.isSertifikat && v.sertifikasi.length === 0) ctx.addIssue({ code: "custom", path: ["sertifikasi"], message: "Pilih minimal satu sertifikasi" });
  })
  // Nilai yang tidak berlaku dikosongkan agar DB tidak menyimpan sisa isian.
  .transform((v) => ({
    ...v,
    kPeriode: v.isPeriode ? v.kPeriode : undefined,
    kRefreshment: v.isRefreshment ? v.kRefreshment : undefined,
    sertifikasi: v.isSertifikat ? [...new Set(v.sertifikasi)] : [],
    jenjang: [...new Set(v.jenjang)],
    kompetensi: [...new Set(v.kompetensi)],
  }));

export const sertifikasiSchema = z.object({
  nama: nama(3, 200),
  statusAktif: bool,
});

export const detailSchema = z.object({
  id: z.string().trim().optional(), // token sub jenis yang sudah ada; kosong = baru
  namaDetail: nama(1, 150),
  statusAktif: z.boolean(),
});


export const jenisSchema = z.object({
  namaJenis: nama(3, 150),
  statusAktif: bool,
  details: z.preprocess(parseJson, z.array(detailSchema).max(50, "Maksimal 50 sub jenis")),
});

export type InstansiInput = z.infer<typeof instansiSchema>;
export type JfInput = z.infer<typeof jfSchema>;
export type KompetensiInput = z.infer<typeof kompetensiSchema>;
export type ProgramInput = z.infer<typeof programSchema>;
export type PelatihanInput = z.infer<typeof pelatihanSchema>;
export type JenjangInput = z.infer<typeof jenjangSchema>;
export type SertifikasiInput = z.infer<typeof sertifikasiSchema>;
export type JenisInput = z.infer<typeof jenisSchema>;
