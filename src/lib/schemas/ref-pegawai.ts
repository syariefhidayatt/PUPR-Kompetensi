import { z } from "zod";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const refSchema = z.object({
  nama: z.string().trim().min(1, "Wajib diisi").max(150, "Maksimal 150 karakter"),
  statusAktif: bool,
});
export type RefInput = z.output<typeof refSchema>;
