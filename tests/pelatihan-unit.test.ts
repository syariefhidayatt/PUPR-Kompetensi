import { describe, expect, it } from "vitest";
import { pelatihanSchema } from "@/lib/schemas/master";
import { isCronAuthorized, needsRefresh, tahunWib } from "@/server/services/pelatihan-refresh";

const base = {
  program: "p",
  namaPelatihan: "Pelatihan dasar",
  jenjang: JSON.stringify(["j1"]),
  kompetensi: JSON.stringify(["k1"]),
  sertifikasi: JSON.stringify([]),
  statusAktif: "on",
};

describe("skema pelatihan", () => {
  it("minimal valid; jenjang & kompetensi wajib ≥ 1", () => {
    expect(pelatihanSchema.safeParse(base).success).toBe(true);
    expect(pelatihanSchema.safeParse({ ...base, jenjang: "[]" }).success).toBe(false);
    expect(pelatihanSchema.safeParse({ ...base, kompetensi: "[]" }).success).toBe(false);
    expect(pelatihanSchema.safeParse({ ...base, kompetensi: "{rusak" }).success).toBe(false);
  });

  it("periode: tahun 2000–2100 wajib bila dicentang; dikosongkan bila tidak", () => {
    expect(pelatihanSchema.safeParse({ ...base, isPeriode: "on" }).success).toBe(false);
    expect(pelatihanSchema.safeParse({ ...base, isPeriode: "on", kPeriode: "1999" }).success).toBe(false);
    expect(pelatihanSchema.safeParse({ ...base, isPeriode: "on", kPeriode: "2101" }).success).toBe(false);
    expect(pelatihanSchema.parse({ ...base, isPeriode: "on", kPeriode: "2026" }).kPeriode).toBe(2026);
    expect(pelatihanSchema.parse({ ...base, kPeriode: "2026" }).kPeriode).toBeUndefined();
  });

  it("refreshment: interval 1–10, dan wajib disertai periode", () => {
    const p = { ...base, isPeriode: "on", kPeriode: "2026", isRefreshment: "on" };
    expect(pelatihanSchema.safeParse(p).success).toBe(false); // interval kosong
    expect(pelatihanSchema.safeParse({ ...p, kRefreshment: "0" }).success).toBe(false);
    expect(pelatihanSchema.safeParse({ ...p, kRefreshment: "11" }).success).toBe(false);
    expect(pelatihanSchema.parse({ ...p, kRefreshment: "5" }).kRefreshment).toBe(5);
    const noPeriode = pelatihanSchema.safeParse({ ...base, isRefreshment: "on", kRefreshment: "5" });
    expect(noPeriode.success).toBe(false);
  });

  it("sertifikat: minimal satu sertifikasi; duplikat dibuang; diabaikan bila tidak dicentang", () => {
    expect(pelatihanSchema.safeParse({ ...base, isSertifikat: "on" }).success).toBe(false);
    const ok = pelatihanSchema.parse({ ...base, isSertifikat: "on", sertifikasi: JSON.stringify(["s1", "s1"]) });
    expect(ok.sertifikasi).toEqual(["s1"]);
    expect(pelatihanSchema.parse({ ...base, sertifikasi: JSON.stringify(["s1"]) }).sertifikasi).toEqual([]);
  });

  it("jenis & kategori teks bebas (opsional)", () => {
    const r = pelatihanSchema.parse({ ...base, jenisPelatihan: "Mutlak", kategoriPelatihan: "  " });
    expect(r.jenisPelatihan).toBe("Mutlak");
    expect(r.kategoriPelatihan).toBeUndefined();
  });
});

describe("refreshment", () => {
  const p = (kPeriode: number | null, kRefreshment: number | null, isRefreshment = true) => ({ isRefreshment, kPeriode, kRefreshment });

  it("needsRefresh: jatuh tempo bila kPeriode + interval <= tahun", () => {
    expect(needsRefresh(p(2026, 5), 2030)).toBe(false);
    expect(needsRefresh(p(2026, 5), 2031)).toBe(true);
    expect(needsRefresh(p(2020, 2), 2031)).toBe(true); // terlambat banyak interval
  });
  it("needsRefresh: tidak berlaku tanpa flag / tanpa data", () => {
    expect(needsRefresh(p(2020, 2, false), 2031)).toBe(false);
    expect(needsRefresh(p(null, 2), 2031)).toBe(false);
    expect(needsRefresh(p(2020, null), 2031)).toBe(false);
  });
  it("idempoten: setelah refresh (kPeriode = tahun) tidak jatuh tempo lagi", () => {
    expect(needsRefresh(p(2031, 5), 2031)).toBe(false);
    expect(needsRefresh(p(2031, 1), 2031)).toBe(false);
  });
  it("tahunWib memakai zona WIB: 31 Des 17:00 UTC sudah tahun baru", () => {
    expect(tahunWib(new Date("2026-12-31T16:59:00Z"))).toBe(2026);
    expect(tahunWib(new Date("2026-12-31T17:00:00Z"))).toBe(2027);
  });
});

describe("isCronAuthorized", () => {
  it("hanya Bearer yang persis; tanpa secret selalu ditolak", () => {
    expect(isCronAuthorized("Bearer rahasia", "rahasia")).toBe(true);
    expect(isCronAuthorized("Bearer salah!", "rahasia")).toBe(false);
    expect(isCronAuthorized("rahasia", "rahasia")).toBe(false);
    expect(isCronAuthorized(null, "rahasia")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer x", undefined)).toBe(false);
  });
});
