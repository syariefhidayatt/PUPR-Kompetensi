import { describe, expect, it } from "vitest";
import { buildMatriks, type MJenjang, type MKomp, type MPel } from "@/server/services/matriks-build";

const komp: MKomp[] = [
  { id: 1n, nama: "K1", jenis: "Teknis", subJenis: "Umum" },
  { id: 2n, nama: "K2", jenis: "Teknis", subJenis: "Umum" },
  { id: 3n, nama: "K3", jenis: "Manajerial", subJenis: "Dasar" },
];
const jenj: MJenjang[] = [
  { id: 10n, nama: "Pertama", rumpun: "Keahlian" },
  { id: 11n, nama: "Muda", rumpun: "Keahlian" },
];
const pel = (id: bigint, nama: string, kompetensi: bigint[], jenjang: bigint[], extra: Partial<MPel> = {}): MPel => ({
  id, nama, kategori: null, sertifikat: false, kompetensi, jenjang, ...extra,
});

describe("buildMatriks", () => {
  it("menempatkan pelatihan pada sel kompetensi × jenjang yang tepat, terurut nama", () => {
    const m = buildMatriks(komp, jenj, [pel(100n, "Zeta", [1n], [10n]), pel(101n, "Alfa", [1n], [10n, 11n])]);
    expect(m.rows[0]!.cells[0]!.map((p) => p.nama)).toEqual(["Alfa", "Zeta"]);
    expect(m.rows[0]!.cells[1]!.map((p) => p.nama)).toEqual(["Alfa"]);
    expect(m.rows[1]!.cells.every((c) => c.length === 0)).toBe(true);
  });

  it("gap & ringkasan: baris tanpa pelatihan di semua jenjang", () => {
    const m = buildMatriks(komp, jenj, [pel(100n, "P", [1n], [11n])]);
    expect(m.rows.map((r) => r.gap)).toEqual([false, true, true]);
    expect(m.summary).toEqual({ total: 3, tercakup: 1, gap: 2 });
  });

  it("pelatihan multi-kompetensi muncul di tiap baris; duplikat pivot tidak menggandakan item", () => {
    const m = buildMatriks(komp, jenj, [pel(100n, "P", [1n, 2n, 1n], [10n, 10n])]);
    expect(m.rows[0]!.cells[0]).toHaveLength(1);
    expect(m.rows[1]!.cells[0]).toHaveLength(1);
  });

  it("kompetensi/jenjang di luar matriks diabaikan (mis. jenjang rumpun lain atau nonaktif)", () => {
    const m = buildMatriks(komp, jenj, [pel(100n, "P", [1n, 999n], [10n, 888n])]);
    expect(m.rows[0]!.cells[0]).toHaveLength(1);
    expect(m.rows[0]!.cells[1]).toHaveLength(0);
    const onlyOutside = buildMatriks(komp, jenj, [pel(101n, "Q", [1n], [888n])]);
    expect(onlyOutside.summary.gap).toBe(3);
  });

  it("membawa kategori & sertifikat; JF tanpa data menghasilkan matriks kosong tanpa error", () => {
    const m = buildMatriks(komp, jenj, [pel(100n, "P", [3n], [10n], { kategori: "Dasar", sertifikat: true })]);
    expect(m.rows[2]!.cells[0]![0]).toMatchObject({ kategori: "Dasar", sertifikat: true });
    expect(buildMatriks([], jenj, [])).toEqual({
      jenjang: [{ id: "10", nama: "Pertama", rumpun: "Keahlian" }, { id: "11", nama: "Muda", rumpun: "Keahlian" }],
      rows: [],
      summary: { total: 0, tercakup: 0, gap: 0 },
    });
  });

  it("nama berisi HTML dibawa apa adanya sebagai teks (escaping dilakukan React)", () => {
    const m = buildMatriks([{ id: 1n, nama: "<script>x</script>", jenis: "J", subJenis: "S" }], jenj, []);
    expect(m.rows[0]!.nama).toBe("<script>x</script>");
  });
});
