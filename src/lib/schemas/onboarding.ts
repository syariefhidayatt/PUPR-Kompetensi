import { z } from "zod";

export const AGAMA = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"] as const;
export const STATUS_PEGAWAI = ["PNS", "PPPK"] as const;

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max = 255) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const optDate = z.preprocess(emptyToUndef, z.coerce.date().optional());
const requiredToken = z.string().trim().min(1, "Wajib dipilih");

/**
 * Catatan: tidak memakai `.strict()` karena Next menyisipkan field `$ACTION_*` ke FormData.
 * Field tak dikenal otomatis dibuang (strip), dan server hanya memakai hasil parse.
 */
export const onboardingSchema = z.object({
  // Biodata
  nip: z.string().trim().regex(/^\d{18}$/, "NIP harus 18 digit angka"),
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(150),
  hp: optText(30),
  telp: optText(30),
  tempatLahir: optText(100),
  tglLahir: optDate,
  jenisKelamin: z.preprocess(emptyToUndef, z.enum(["L", "P"]).optional()),
  agama: z.preprocess(emptyToUndef, z.enum(AGAMA).optional()),
  alamat: optText(500),
  pendidikan: optText(100),
  jurusan: optText(150),
  golongan: optText(20),
  tmt: optDate,
  // Penempatan awal (token ID publik; divalidasi ulang di server)
  instansi: requiredToken,
  jf: requiredToken,
  jenjang: requiredToken,
  statusPegawai: z.enum(STATUS_PEGAWAI, { errorMap: () => ({ message: "Pilih status pegawai" }) }),
  tglMulai: z.coerce.date({ errorMap: () => ({ message: "Tanggal mulai wajib diisi" }) }),
  noSk: optText(100),
  keterangan: optText(500),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
