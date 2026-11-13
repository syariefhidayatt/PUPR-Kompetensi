import { describe, expect, it } from "vitest";
import { biodataSchema, pegawaiBaruSchema, penempatanSchema } from "@/lib/schemas/pegawai";
import { refSchema } from "@/lib/schemas/ref-pegawai";
import { createIds } from "@/server/ids";

const bio = { nip: "198001012005011001", nama: "Budi Santoso" };
const pen = { instansi: "tok", tglMulai: "2024-01-01" };

describe("skema pegawai", () => {
  it("biodata minimal valid; kolom kosong → undefined", () => {
    const r = biodataSchema.parse({ ...bio, email: "", hp: " ", tglLahir: "", jenisKelamin: "" });
    expect(r.email).toBeUndefined();
    expect(r.hp).toBeUndefined();
    expect(r.tglLahir).toBeUndefined();
    expect(r.jenisKelamin).toBeUndefined();
  });
  it("NIP: hanya huruf/angka & panjang; email, jenis kelamin, agama, tanggal divalidasi", () => {
    expect(biodataSchema.safeParse({ ...bio, nip: "12 34" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, nip: "123" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, email: "bukan-email" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, jenisKelamin: "X" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, agama: "Islam" }).success).toBe(true);
    expect(biodataSchema.safeParse({ ...bio, agama: "Lain-lain" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, tglLahir: "2020-13-45" }).success).toBe(false);
    expect(biodataSchema.safeParse({ ...bio, tglLahir: "01/01/2020" }).success).toBe(false);
  });
  it("penempatan: instansi & tanggal mulai wajib", () => {
    expect(penempatanSchema.safeParse(pen).success).toBe(true);
    expect(penempatanSchema.safeParse({ ...pen, instansi: "" }).success).toBe(false);
    expect(penempatanSchema.safeParse({ instansi: "tok" }).success).toBe(false);
    expect(penempatanSchema.parse({ ...pen, jf: "", unitKerja: "" }).jf).toBeUndefined();
  });
  it("pegawai baru: satu form datar dipecah jadi biodata + penempatan", () => {
    const r = pegawaiBaruSchema.parse({ ...bio, ...pen, noSk: "SK-1" });
    expect(r.biodata.nip).toBe(bio.nip);
    expect(r.penempatan.noSk).toBe("SK-1");
    expect(pegawaiBaruSchema.safeParse({ ...bio }).success).toBe(false);
  });
  it("referensi: nama wajib; token golongan/pendidikan/status tidak tertukar", () => {
    expect(refSchema.safeParse({ nama: " " }).success).toBe(false);
    expect(refSchema.parse({ nama: "III/a", statusAktif: "on" }).statusAktif).toBe(true);
    const ids = createIds("salt-uji-minimal-16-karakter");
    const t = ids.encode("golongan", 2n);
    expect(ids.decode("golongan", t)).toBe(2n);
    expect(ids.decode("pendidikan", t)).toBeNull();
    expect(ids.decode("statusPegawai", t)).toBeNull();
  });
});
