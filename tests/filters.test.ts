import { describe, expect, it } from "vitest";
import { andOf, ci, fAktif, fEnum, fInt, fYa, filterParams, readFilters } from "@/lib/filters";

describe("filter kolom", () => {
  it("readFilters: hanya f_*, dipangkas, kosong dibuang, kunci aneh ditolak", () => {
    const f = readFilters({ q: "x", page: "2", f_nama: "  budi ", f_kosong: "  ", "f_a-b": "x", f_panjang: "y".repeat(300), f_arr: ["a", "b"] });
    expect(f.nama).toBe("budi");
    expect(f.kosong).toBeUndefined();
    expect(f["a-b"]).toBeUndefined();
    expect(f.panjang).toHaveLength(100);
    expect(f.arr).toBe("a");
    expect(f.q).toBeUndefined();
  });
  it("jumlah kunci dibatasi", () => {
    const sp = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`f_k${i}`, "v"]));
    expect(Object.keys(readFilters(sp))).toHaveLength(20);
  });
  it("filterParams membalik readFilters", () => {
    expect(filterParams({ nama: "a", jenis: "2" })).toEqual({ f_nama: "a", f_jenis: "2" });
  });
  it("pembantu where: kosong/tak valid → undefined", () => {
    expect(ci(undefined)).toBeUndefined();
    expect(ci("x")).toEqual({ contains: "x", mode: "insensitive" });
    expect(fInt("12")).toBe(12);
    expect(fInt("abc")).toBeUndefined();
    expect(fInt("1; DROP")).toBeUndefined();
    expect(fAktif("aktif")).toBe(true);
    expect(fAktif("nonaktif")).toBe(false);
    expect(fAktif("x")).toBeUndefined();
    expect(fYa("ya")).toBe(true);
    expect(fYa("tidak")).toBe(false);
    expect(fEnum("KEAHLIAN", ["KEAHLIAN", "KETERAMPILAN"] as const)).toBe("KEAHLIAN");
    expect(fEnum("lain", ["KEAHLIAN"] as const)).toBeUndefined();
    expect(andOf([undefined, "", { a: 1 }, false, null])).toEqual([{ a: 1 }]);
  });
});
