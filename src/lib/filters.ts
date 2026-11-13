// Filter per kolom pada halaman daftar. Parameter URL: f_<kunci>=nilai (GET biasa, tanpa JS).
import type { Prisma } from "@prisma/client";

export type Filters = Record<string, string>;
export type FilterDef = {
  key: string;
  label: string;
  type?: "text" | "select" | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const MAX_KEYS = 20;
const MAX_LEN = 100;

/** Ambil f_* dari searchParams: dipangkas, dibatasi jumlah/panjangnya, nilai kosong dibuang. */
export function readFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const out: Filters = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!k.startsWith("f_") || out[k.slice(2)] !== undefined) continue;
    const val = (Array.isArray(v) ? v[0] : v)?.trim().slice(0, MAX_LEN);
    if (val && /^\w+$/.test(k.slice(2)) && Object.keys(out).length < MAX_KEYS) out[k.slice(2)] = val;
  }
  return out;
}

/** Kebalikan readFilters: untuk tautan paginasi / form pencarian. */
export function filterParams(f: Filters): Record<string, string> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [`f_${k}`, v]));
}

// ---- Pembantu where Prisma (nilai kosong → undefined = tidak memfilter) ----
export const ci = (v: string | undefined): Prisma.StringFilter | undefined => (v ? { contains: v, mode: "insensitive" } : undefined);
export const fInt = (v: string | undefined): number | undefined => (v !== undefined && /^\d{1,6}$/.test(v) ? Number(v) : undefined);
/** "aktif" → true, "nonaktif" → false, lainnya → tidak memfilter. */
export const fAktif = (v: string | undefined): boolean | undefined => (v === "aktif" ? true : v === "nonaktif" ? false : undefined);
/** "ya" → true, "tidak" → false. */
export const fYa = (v: string | undefined): boolean | undefined => (v === "ya" ? true : v === "tidak" ? false : undefined);
export function fEnum<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === v);
}
/** Susun daftar kondisi AND; entri falsy dibuang. */
export function andOf<T>(xs: (T | false | undefined | null | "")[]): T[] {
  return xs.filter(Boolean) as T[];
}

export const STATUS_OPTIONS = [
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
];
export const YA_TIDAK_OPTIONS = [
  { value: "ya", label: "Ya" },
  { value: "tidak", label: "Tidak" },
];
