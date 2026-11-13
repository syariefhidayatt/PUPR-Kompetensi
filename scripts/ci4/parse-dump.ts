/**
 * Parser dump pg_dump CI4 (format INSERT, bukan COPY). Murni: tanpa I/O, tanpa DB.
 * Mengurai `CREATE TABLE public.x (...)` untuk nama kolom dan `INSERT INTO public.x VALUES (...);`
 * untuk baris, lalu mengembalikan baris sebagai objek { kolom: nilai }.
 */
export type Val = string | number | boolean | null;
export type Row = Record<string, Val>;
export type Dump = Record<string, Row[]>;

/** Mengurai isi tanda kurung VALUES: string '..' (escape ''), NULL, true/false, angka. */
export function parseValues(s: string): Val[] {
  const out: Val[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && (s[i] === " " || s[i] === ",")) i++;
    if (i >= n) break;
    if (s[i] === "'") {
      let v = "";
      i++;
      for (;;) {
        if (i >= n) throw new Error("String tidak tertutup");
        const c = s[i];
        if (c === "'") {
          if (s[i + 1] === "'") {
            v += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        v += c;
        i++;
      }
      out.push(v);
    } else {
      let j = i;
      while (j < n && s[j] !== ",") j++;
      const tok = s.slice(i, j).trim();
      i = j;
      if (tok === "NULL") out.push(null);
      else if (tok === "true") out.push(true);
      else if (tok === "false") out.push(false);
      else if (/^-?\d+(\.\d+)?$/.test(tok)) out.push(Number(tok));
      else throw new Error(`Token tidak dikenal: ${tok.slice(0, 30)}`);
    }
  }
  return out;
}

export function parseDump(sql: string): Dump {
  const cols: Record<string, string[]> = {};
  for (const m of sql.matchAll(/CREATE TABLE public\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/g)) {
    const name = m[1] as string;
    cols[name] = (m[2] as string)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/.test(l))
      .map((l) => (l.split(/\s+/)[0] as string).replace(/"/g, ""));
  }
  const dump: Dump = {};
  for (const line of sql.split(/\r?\n/)) {
    const m = /^INSERT INTO public\.(\w+) VALUES \((.*)\);$/.exec(line);
    if (!m) continue;
    const table = m[1] as string;
    const names = cols[table];
    if (!names) throw new Error(`INSERT untuk tabel tanpa CREATE TABLE: ${table}`);
    const vals = parseValues(m[2] as string);
    if (vals.length !== names.length) {
      throw new Error(`${table}: ${vals.length} nilai, ${names.length} kolom`);
    }
    const row: Row = {};
    names.forEach((c, i) => (row[c] = vals[i] as Val));
    (dump[table] ??= []).push(row);
  }
  return dump;
}
