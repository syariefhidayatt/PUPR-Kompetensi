import { z } from "zod";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const BATCH_STATUS = ["draft", "terjadwal", "berjalan", "selesai", "dibatalkan"] as const;
export const BATCH_STATUS_LABEL: Record<(typeof BATCH_STATUS)[number], string> = {
  draft: "Draft",
  terjadwal: "Terjadwal",
  berjalan: "Berjalan",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};
export const KEHADIRAN = ["terdaftar", "hadir", "selesai", "tidak_hadir"] as const;
export const KEHADIRAN_LABEL: Record<(typeof KEHADIRAN)[number], string> = {
  terdaftar: "Terdaftar",
  hadir: "Hadir",
  selesai: "Selesai",
  tidak_hadir: "Tidak hadir",
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid");

export const penyelenggaraSchema = z.object({
  nama: z.string().trim().min(3, "Minimal 3 karakter").max(200, "Maksimal 200 karakter"),
  statusAktif: bool,
});

export const batchSchema = z
  .object({
    pelatihan: z.string().trim().min(1, "Pilih pelatihan"),
    penyelenggara: z.preprocess(emptyToUndef, z.string().trim().optional()),
    tahunPelaksanaan: z.coerce.number({ message: "Isi tahun" }).int().min(2000, "Tahun tidak valid").max(2100, "Tahun tidak valid"),
    angkatan: z.string().trim().min(1, "Wajib diisi").max(20, "Maksimal 20 karakter"),
    tanggalMulai: date,
    tanggalSelesai: date,
    kapasitas: z.coerce.number({ message: "Isi kapasitas (0 = tanpa batas)" }).int().min(0, "Minimal 0").max(100000),
    statusBatch: z.enum(BATCH_STATUS, { message: "Pilih status" }),
    keterangan: z.preprocess(emptyToUndef, z.string().trim().max(1000).optional()),
    statusAktif: bool,
  })
  .superRefine((v, ctx) => {
    if (v.tanggalMulai && v.tanggalSelesai && v.tanggalSelesai < v.tanggalMulai) {
      ctx.addIssue({ code: "custom", path: ["tanggalSelesai"], message: "Tidak boleh sebelum tanggal mulai" });
    }
  });

export const setujuiSchema = z.object({ batch: z.preprocess(emptyToUndef, z.string().trim().optional()) });
export const daftarBatchSchema = z.object({ batch: z.string().trim().min(1, "Pilih batch") });
export const tolakSchema = z.object({ alasan: z.string().trim().min(5, "Isi alasan penolakan (minimal 5 karakter)").max(1000) });
export const kehadiranSchema = z.object({ status: z.enum(KEHADIRAN, { message: "Status tidak valid" }) });

export type PenyelenggaraInput = z.output<typeof penyelenggaraSchema>;
export type BatchInput = z.output<typeof batchSchema>;
