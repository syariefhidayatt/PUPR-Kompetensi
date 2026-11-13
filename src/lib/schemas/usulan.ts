import { z } from "zod";

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const usulanSchema = z.object({
  pelatihan: z.string().trim().min(1, "Pilih pelatihan"),
  // Hanya dipakai admin (usulan atas nama pegawai); untuk pegawai diabaikan di service.
  pegawai: z.preprocess(emptyToUndef, z.string().trim().max(100).optional()),
  alasan: z.preprocess(emptyToUndef, z.string().trim().max(1000, "Maksimal 1000 karakter").optional()),
});
