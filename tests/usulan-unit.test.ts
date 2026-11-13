import { describe, expect, it } from "vitest";
import { usulanSchema } from "@/lib/schemas/usulan";
import { bisaDibatalkan, prasyaratTerpenuhi, rolePrimer, statusAwal, STATUS_HIDUP } from "@/server/services/usulan-rules";
import { createIds } from "@/server/ids";

describe("aturan usulan", () => {
  it("status awal: sendiri → mengusulkan, atas nama → diajukan", () => {
    expect(statusAwal(true)).toBe("mengusulkan");
    expect(statusAwal(false)).toBe("diajukan");
  });
  it("hanya mengusulkan/diajukan yang bisa dibatalkan", () => {
    expect(bisaDibatalkan("mengusulkan")).toBe(true);
    expect(bisaDibatalkan("diajukan")).toBe(true);
    for (const s of ["disetujui", "ditolak", "dibatalkan", "x"]) expect(bisaDibatalkan(s)).toBe(false);
  });
  it("status hidup = yang tercakup indeks uq_usulan_aktif", () => {
    expect(STATUS_HIDUP).toEqual(["mengusulkan", "diajukan", "disetujui"]);
  });
  it("prasyarat jenjang: kosong = bebas; tanpa jenjang gagal bila ada prasyarat", () => {
    expect(prasyaratTerpenuhi(null, [])).toBe(true);
    expect(prasyaratTerpenuhi(2n, [])).toBe(true);
    expect(prasyaratTerpenuhi(2n, [1n, 2n])).toBe(true);
    expect(prasyaratTerpenuhi(3n, [1n, 2n])).toBe(false);
    expect(prasyaratTerpenuhi(null, [1n])).toBe(false);
  });
  it("role primer memilih yang tertinggi", () => {
    expect(rolePrimer(["pegawai", "admin_instansi"])).toBe("admin_instansi");
    expect(rolePrimer(["lain"])).toBe("lain");
    expect(rolePrimer([])).toBeNull();
  });
});

describe("skema usulan", () => {
  it("pelatihan wajib; alasan & pegawai kosong → undefined; alasan maks 1000", () => {
    expect(usulanSchema.safeParse({ pelatihan: "" }).success).toBe(false);
    const r = usulanSchema.parse({ pelatihan: "abc", alasan: "  ", pegawai: "" });
    expect(r.alasan).toBeUndefined();
    expect(r.pegawai).toBeUndefined();
    expect(usulanSchema.safeParse({ pelatihan: "abc", alasan: "x".repeat(1001) }).success).toBe(false);
  });
  it("token usulan tidak tertukar dengan pelatihan", () => {
    const ids = createIds("salt-uji-minimal-16-karakter");
    const t = ids.encode("usulan", 4n);
    expect(ids.decode("usulan", t)).toBe(4n);
    expect(ids.decode("pelatihan", t)).toBeNull();
  });
});
