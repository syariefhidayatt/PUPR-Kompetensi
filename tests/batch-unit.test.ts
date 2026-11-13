import { describe, expect, it } from "vitest";
import { batchSchema, daftarBatchSchema, setujuiSchema, tolakSchema } from "@/lib/schemas/batch";
import { batchTerbuka, penuh, sisaKursi } from "@/server/services/batch-rules";
import { createIds } from "@/server/ids";

describe("aturan batch", () => {
  it("hanya draft/terjadwal yang menerima pendaftaran", () => {
    expect(batchTerbuka("draft")).toBe(true);
    expect(batchTerbuka("terjadwal")).toBe(true);
    for (const s of ["berjalan", "selesai", "dibatalkan", "x"]) expect(batchTerbuka(s)).toBe(false);
  });
  it("kapasitas 0 = tanpa batas; penuh bila terisi >= kapasitas", () => {
    expect(penuh(0, 9999)).toBe(false);
    expect(penuh(2, 1)).toBe(false);
    expect(penuh(2, 2)).toBe(true);
    expect(penuh(2, 3)).toBe(true);
    expect(sisaKursi(0, 5)).toBeNull();
    expect(sisaKursi(10, 3)).toBe(7);
    expect(sisaKursi(3, 9)).toBe(0);
  });
});

describe("skema batch & persetujuan", () => {
  const ok = {
    pelatihan: "tok", tahunPelaksanaan: "2026", angkatan: "I", tanggalMulai: "2026-07-16", tanggalSelesai: "2026-07-17",
    kapasitas: "100", statusBatch: "terjadwal", statusAktif: "on",
  };
  it("valid; tanggal selesai < mulai ditolak; kapasitas negatif ditolak; status tak dikenal ditolak", () => {
    expect(batchSchema.safeParse(ok).success).toBe(true);
    expect(batchSchema.safeParse({ ...ok, tanggalSelesai: "2026-07-15" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...ok, kapasitas: "-1" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...ok, statusBatch: "lain" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...ok, kapasitas: "0" }).success).toBe(true);
  });
  it("setujui: batch opsional; daftar batch: wajib; tolak: alasan minimal 5 karakter", () => {
    expect(setujuiSchema.parse({ batch: "" }).batch).toBeUndefined();
    expect(daftarBatchSchema.safeParse({ batch: "" }).success).toBe(false);
    expect(tolakSchema.safeParse({ alasan: "abc" }).success).toBe(false);
    expect(tolakSchema.safeParse({ alasan: "Kuota habis" }).success).toBe(true);
  });
  it("token batch/peserta/penyelenggara tidak saling tertukar", () => {
    const ids = createIds("salt-uji-minimal-16-karakter");
    const t = ids.encode("batch", 3n);
    expect(ids.decode("batch", t)).toBe(3n);
    expect(ids.decode("peserta", t)).toBeNull();
    expect(ids.decode("penyelenggara", t)).toBeNull();
    expect(ids.decode("usulan", t)).toBeNull();
  });
});
