import { describe, expect, it } from "vitest";
import { createIds } from "@/server/ids";

const ids = createIds("salt-uji-minimal-16-karakter");

describe("ids (Sqids)", () => {
  it("round-trip encode → decode", () => {
    for (const n of [1n, 42n, 999_999n]) {
      expect(ids.decode("instansi", ids.encode("instansi", n))).toBe(n);
    }
  });

  it("token selalu ≥ 10 karakter dan tidak memuat id polos", () => {
    const t = ids.encode("jf", 7n);
    expect(t.length).toBeGreaterThanOrEqual(10);
    expect(t).not.toBe("7");
  });

  it("menolak token jenis entitas lain", () => {
    const t = ids.encode("instansi", 5n);
    expect(ids.decode("jf", t)).toBeNull();
  });

  it("menolak token rusak / bukan string / terlalu panjang", () => {
    expect(ids.decode("instansi", "!!!")).toBeNull();
    expect(ids.decode("instansi", "")).toBeNull();
    expect(ids.decode("instansi", 123)).toBeNull();
    expect(ids.decode("instansi", "a".repeat(100))).toBeNull();
  });

  it("salt berbeda → token berbeda", () => {
    const other = createIds("salt-lain-minimal-16-karakter");
    expect(other.encode("jf", 7n)).not.toBe(ids.encode("jf", 7n));
  });
});
