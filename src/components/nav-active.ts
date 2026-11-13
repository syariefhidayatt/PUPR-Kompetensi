/** Item aktif = href dengan awalan terpanjang yang cocok (agar /pelatihan tidak ikut aktif di /pelatihan/matriks). */
export function pilihAktif(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    const cocok = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`);
    if (cocok && (best === null || h.length > best.length)) best = h;
  }
  return best;
}
