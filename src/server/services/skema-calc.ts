/** Teks kolom Refreshment, mis. "Ya, tiap 5 thn". */
export function teksRefresh(isRefreshment: boolean, k: number | null): string {
  return !isRefreshment ? "Tidak" : k ? `Ya, tiap ${k} thn` : "Ya";
}
