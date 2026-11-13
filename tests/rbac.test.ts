import { describe, expect, it } from "vitest";
import { hasPermission, scopeFor } from "@/server/auth/rbac";

describe("hasPermission", () => {
  it("true hanya bila permission ada", () => {
    expect(hasPermission({ permissions: ["pelatihan.view"] }, "pelatihan.view")).toBe(true);
    expect(hasPermission({ permissions: ["pelatihan.view"] }, "pelatihan.update")).toBe(false);
    expect(hasPermission({ permissions: [] }, "pelatihan.view")).toBe(false);
  });
});

describe("scopeFor", () => {
  it("admin_pusat → all", () => {
    expect(scopeFor({ id: "1", roles: ["admin_pusat"], idInstansi: null })).toEqual({ kind: "all" });
  });
  it("admin_instansi & pembina → instansi sendiri", () => {
    for (const role of ["admin_instansi", "pembina"]) {
      expect(scopeFor({ id: "2", roles: [role], idInstansi: "9" })).toEqual({ kind: "instansi", idInstansi: 9n });
    }
  });
  it("admin_instansi tanpa instansi → self (fail-safe, bukan all)", () => {
    expect(scopeFor({ id: "3", roles: ["admin_instansi"], idInstansi: null })).toEqual({ kind: "self", idUser: 3n });
  });
  it("pegawai → self", () => {
    expect(scopeFor({ id: "4", roles: ["pegawai"], idInstansi: "9" })).toEqual({ kind: "self", idUser: 4n });
  });
});
