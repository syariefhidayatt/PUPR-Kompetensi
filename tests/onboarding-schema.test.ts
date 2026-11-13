import { describe, expect, it } from "vitest";
import { onboardingSchema } from "@/lib/schemas/onboarding";

const valid = {
  nip: "198001012005011001",
  nama: "Budi Santoso",
  instansi: "tokInstansi",
  jf: "tokJf",
  jenjang: "tokJenjang",
  statusPegawai: "PNS",
  tglMulai: "2024-01-31",
};

describe("onboardingSchema", () => {
  it("menerima data minimal valid dan mengubah isian kosong menjadi undefined", () => {
    const r = onboardingSchema.safeParse({ ...valid, hp: "", alamat: "  ", tglLahir: "", agama: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hp).toBeUndefined();
      expect(r.data.alamat).toBeUndefined();
      expect(r.data.tglLahir).toBeUndefined();
      expect(r.data.agama).toBeUndefined();
      expect(r.data.tglMulai).toBeInstanceOf(Date);
    }
  });

  it("menolak NIP bukan 18 digit", () => {
    expect(onboardingSchema.safeParse({ ...valid, nip: "123" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, nip: "19800101200501100x" }).success).toBe(false);
  });

  it("menolak status pegawai di luar daftar dan tglMulai kosong", () => {
    expect(onboardingSchema.safeParse({ ...valid, statusPegawai: "Honorer" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, tglMulai: "" }).success).toBe(false);
  });

  it("membuang field tak dikenal (mis. $ACTION_ID dari Next)", () => {
    const r = onboardingSchema.safeParse({ ...valid, $ACTION_ID_abc: "x", idInstansi: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect("idInstansi" in r.data).toBe(false);
  });
});
