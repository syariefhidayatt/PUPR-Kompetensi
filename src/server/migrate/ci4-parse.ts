/**
 * Parser murni untuk dump pg_dump CI4 (format `INSERT INTO public.<tabel> VALUES (...);`).
 * Nama kolom diambil dari `CREATE TABLE`, sehingga baris menjadi objek berkunci nama kolom
 * (tidak bergantung urutan kolom). Tidak ada akses DB/file di sini agar mudah diuji.
 */
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
export type Dump = Record<string, Row[]>;

export function parseColumns(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const re = /^CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/gm;
  for (const m of sql.matchAll(re)) {
    const cols: string[] = [];
    for (const line of (m[2] ?? "").split("\n")) {
      const t = line.trim();
      if (!t || /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(t)) continue;
      const name = t.split(/\s+/)[0];
      if (name) cols.push(name.replace(/"/g, ""));
    }
    if (m[1]) out[m[1]] = cols;
  }
  return out;
}

/** Membaca satu daftar nilai mulai tepat setelah "(" ; mengembalikan nilai dan posisi setelah ")". */
function readValues(s: string, start: number): { values: Cell[]; end: number } {
  const values: Cell[] = [];
  let i = start;
  for (;;) {
    while (s[i] === " ") i++;
    const c = s[i];
    if (c === "'") {
      let buf = "";
      i++;
      for (;;) {
        const j = s.indexOf("'", i);
        if (j === -1) throw new Error("String tidak tertutup");
        buf += s.slice(i, j);
        if (s[j + 1] === "'") {
          buf += "'";
          i = j + 2;
        } else {
          i = j + 1;
          break;
        }
      }
      values.push(buf);
    } else {
      let j = i;
      while (j < s.length && s[j] !== "," && s[j] !== ")") j++;
      const tok = s.slice(i, j).trim();
      i = j;
      if (tok === "NULL") values.push(null);
      else if (tok === "true") values.push(true);
      else if (tok === "false") values.push(false);
      else if (/^-?\d+(\.\d+)?$/.test(tok)) values.push(Number(tok));
      else throw new Error(`Token tidak dikenal: ${tok.slice(0, 30)}`);
    }
    while (s[i] === " ") i++;
    if (s[i] === ",") {
      i++;
      continue;
    }
    if (s[i] === ")") return { values, end: i + 1 };
    throw new Error(`Karakter tak terduga pada posisi ${i}`);
  }
}

export function parseDump(sql: string): { rows: Dump; columns: Record<string, string[]> } {
  const columns = parseColumns(sql);
  const rows: Dump = {};
  const re = /^INSERT INTO public\.(\w+) VALUES \(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1] as string;
    const cols = columns[table];
    if (!cols) throw new Error(`Tabel ${table} tidak punya CREATE TABLE`);
    const { values, end } = readValues(sql, re.lastIndex);
    if (values.length !== cols.length) throw new Error(`${table}: ${values.length} nilai, ${cols.length} kolom`);
    const row: Row = {};
    cols.forEach((c, k) => (row[c] = values[k] ?? null));
    (rows[table] ??= []).push(row);
    re.lastIndex = end;
  }
  return { rows, columns };
}

// ---------- Pemetaan nilai ----------
export const AGAMA: Record<number, string> = { 1: "Islam", 2: "Kristen", 3: "Katolik", 4: "Hindu", 5: "Buddha", 6: "Konghucu", 7: "Lainnya" };

export function jenisKelamin(v: Cell | undefined): "L" | "P" | null {
  return v === 1 ? "L" : v === 2 ? "P" : null;
}
export function agama(v: Cell | undefined): string | null {
  return typeof v === "number" ? (AGAMA[v] ?? null) : null;
}
/** "PNS (Deleted 1783878672)" → "PNS" */
export function stripDeleted(s: string): string {
  return s.replace(/\s*\(Deleted \d+\)\s*$/, "").trim();
}
export function rumpunDariNama(nama: string): "KEAHLIAN" | "KETERAMPILAN" | null {
  if (/\b(pertama|muda|madya|utama)\b/i.test(nama)) return "KEAHLIAN";
  if (/\b(pemula|terampil|mahir|penyelia)\b/i.test(nama)) return "KETERAMPILAN";
  return null;
}
export function dateOnly(v: Cell | undefined): Date | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null;
}
export const aktif = (r: Row) => r.deleted_at == null;
/** '2026-07-13 00:42:25+00' → Date (format timestamptz pg_dump). */
export function timestamp(v: Cell | undefined): Date | null {
  if (typeof v !== "string") return null;
  let t = v.trim().replace(" ", "T");
  if (/[+-]\d\d$/.test(t)) t += ":00";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
