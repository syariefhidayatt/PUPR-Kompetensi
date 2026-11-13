import { describe, expect, it } from "vitest";
import { pilihAktif } from "@/components/nav-active";

const HREFS = ["/", "/pelatihan", "/pelatihan/matriks", "/pengelolaan/batch", "/master/unit-kerja"];

describe("menu aktif", () => {
  it("awalan terpanjang menang", () => {
    expect(pilihAktif("/pelatihan/matriks", HREFS)).toBe("/pelatihan/matriks");
    expect(pilihAktif("/pengelolaan/batch/abc123", HREFS)).toBe("/pengelolaan/batch");
    expect(pilihAktif("/pelatihan", HREFS)).toBe("/pelatihan");
  });
  it("Beranda hanya cocok persis; jalur tak dikenal → tidak ada yang aktif", () => {
    expect(pilihAktif("/", HREFS)).toBe("/");
    expect(pilihAktif("/lain", HREFS)).toBeNull();
  });
  it("tidak cocok pada awalan sebagian nama (/pelatihanx)", () => {
    expect(pilihAktif("/pelatihanx", HREFS)).toBeNull();
  });
});
