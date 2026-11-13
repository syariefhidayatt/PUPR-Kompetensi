import { describe, expect, it } from "vitest";
import { teksRefresh } from "@/server/services/skema-calc";

describe("teksRefresh", () => {
  it("format kolom refreshment", () => {
    expect(teksRefresh(true, 5)).toBe("Ya, tiap 5 thn");
    expect(teksRefresh(true, null)).toBe("Ya");
    expect(teksRefresh(false, 5)).toBe("Tidak");
  });
});
