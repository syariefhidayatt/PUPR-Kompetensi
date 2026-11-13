// Fungsi murni (tanpa DB) agar mudah diuji. Merakit matriks Kompetensi × Jenjang dari data mentah.

export type MKomp = { id: bigint; nama: string; jenis: string; subJenis: string };
export type MJenjang = { id: bigint; nama: string; rumpun: string };
export type MPel = {
  id: bigint;
  nama: string;
  kategori: string | null;
  sertifikat: boolean;
  kompetensi: bigint[];
  jenjang: bigint[];
};

export type MatriksItem = { id: string; nama: string; kategori: string | null; sertifikat: boolean };
export type MatriksRow = {
  id: string;
  nama: string;
  jenis: string;
  subJenis: string;
  cells: MatriksItem[][]; // sejajar dengan urutan `jenjang`
  gap: boolean; // tidak ada pelatihan di jenjang mana pun
};
export type MatriksData = {
  jenjang: { id: string; nama: string; rumpun: string }[];
  rows: MatriksRow[];
  summary: { total: number; tercakup: number; gap: number };
};

const byNama = (a: MatriksItem, b: MatriksItem) => a.nama.localeCompare(b.nama, "id");

/**
 * Urutan baris mengikuti urutan `kompetensi` (service sudah mengurutkan jenis → sub jenis → nama).
 * Pelatihan yang menunjuk kompetensi/jenjang di luar daftar diabaikan (bukan bagian matriks ini).
 */
export function buildMatriks(kompetensi: MKomp[], jenjang: MJenjang[], pelatihan: MPel[]): MatriksData {
  const kIndex = new Map(kompetensi.map((k, i) => [k.id, i]));
  const jIndex = new Map(jenjang.map((j, i) => [j.id, i]));
  const cells: MatriksItem[][][] = kompetensi.map(() => jenjang.map(() => []));

  for (const p of pelatihan) {
    const item: MatriksItem = { id: String(p.id), nama: p.nama, kategori: p.kategori, sertifikat: p.sertifikat };
    for (const idK of new Set(p.kompetensi)) {
      const ki = kIndex.get(idK);
      if (ki === undefined) continue;
      for (const idJ of new Set(p.jenjang)) {
        const ji = jIndex.get(idJ);
        if (ji !== undefined) cells[ki]![ji]!.push(item);
      }
    }
  }

  const rows: MatriksRow[] = kompetensi.map((k, ki) => {
    const rowCells = cells[ki]!.map((c) => [...c].sort(byNama));
    return {
      id: String(k.id),
      nama: k.nama,
      jenis: k.jenis,
      subJenis: k.subJenis,
      cells: rowCells,
      gap: rowCells.every((c) => c.length === 0),
    };
  });
  const gap = rows.filter((r) => r.gap).length;
  return {
    jenjang: jenjang.map((j) => ({ id: String(j.id), nama: j.nama, rumpun: j.rumpun })),
    rows,
    summary: { total: rows.length, tercakup: rows.length - gap, gap },
  };
}
