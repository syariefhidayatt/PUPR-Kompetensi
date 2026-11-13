import { z } from "zod";

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max: number) => z.preprocess(emptyToUndef, z.string().trim().max(max, `Maksimal ${max} karakter`).optional());
const tanggal = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid").refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Tanggal tidak valid");
const optTanggal = z.preprocess(emptyToUndef, tanggal.optional());

export const AGAMA_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"] as const;

export const biodataSchema = z.object({
  nip: z.string().trim().min(5, "Minimal 5 karakter").max(30, "Maksimal 30 karakter").regex(/^[A-Za-z0-9]+$/, "NIP hanya huruf dan angka"),
  nama: z.string().trim().min(3, "Minimal 3 karakter").max(255, "Maksimal 255 karakter"),
  email: z.preprocess(emptyToUndef, z.string().trim().email("Email tidak valid").max(255).optional()),
  hp: optText(30),
  telp: optText(30),
  tempatLahir: optText(100),
  tglLahir: optTanggal,
  jenisKelamin: z.preprocess(emptyToUndef, z.enum(["L", "P"], { message: "Pilih L atau P" }).optional()),
  agama: z.preprocess(emptyToUndef, z.enum(AGAMA_LIST, { message: "Agama tidak valid" }).optional()),
  alamat: optText(500),
  pendidikan: optText(150),
  jurusan: optText(150),
  golongan: optText(150),
  tmt: optTanggal,
});

export const penempatanSchema = z.object({
  instansi: z.string().trim().min(1, "Wajib dipilih"),
  unitOrganisasi: z.preprocess(emptyToUndef, z.string().trim().optional()),
  unitKerja: z.preprocess(emptyToUndef, z.string().trim().optional()),
  jf: z.preprocess(emptyToUndef, z.string().trim().optional()),
  jenjang: z.preprocess(emptyToUndef, z.string().trim().optional()),
  statusPegawai: optText(150),
  tglMulai: tanggal,
  noSk: optText(150),
  keterangan: optText(500),
});

// Pegawai baru = biodata + penempatan awal dalam satu form datar (nama field tidak bertabrakan; zod membuang kunci asing).
export const pegawaiBaruSchema = z.preprocess(
  (v) => (v && typeof v === "object" ? { biodata: v, penempatan: v } : v),
  z.object({ biodata: biodataSchema, penempatan: penempatanSchema }),
);

export type BiodataInput = z.output<typeof biodataSchema>;
export type PenempatanInput = z.output<typeof penempatanSchema>;
