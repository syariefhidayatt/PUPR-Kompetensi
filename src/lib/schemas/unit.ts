import { z } from "zod";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const teks = (min: number, max: number) => z.string().trim().min(min, `Minimal ${min} karakter`).max(max, `Maksimal ${max} karakter`);

export const unitOrganisasiSchema = z.object({
  instansi: z.string().trim().min(1, "Wajib dipilih"),
  kode: teks(1, 50),
  nama: teks(3, 255),
  statusAktif: bool,
});

export const unitKerjaSchema = z.object({
  instansi: z.string().trim().min(1, "Wajib dipilih"),
  unitOrganisasi: z.preprocess(emptyToUndef, z.string().trim().optional()),
  kode: teks(1, 50),
  nama: teks(3, 255),
  statusAktif: bool,
});

export type UnitOrganisasiInput = z.output<typeof unitOrganisasiSchema>;
export type UnitKerjaInput = z.output<typeof unitKerjaSchema>;
