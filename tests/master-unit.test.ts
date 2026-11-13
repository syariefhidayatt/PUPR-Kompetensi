import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  instansiSchema,
  jenisSchema,
  kompetensiSchema,
  programSchema,
  jenjangSchema,
  jfSchema,
  sertifikasiSchema,
} from "@/lib/schemas/master";
import { AppError } from "@/server/errors";
import { createIds } from "@/server/ids";
import { conflictIfUsed, decodeOr404, pageParams, parseForm, run } from "@/server/services/master/shared";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe("skema master", () => {
  it("checkbox: ada 'on' → true, tidak ada → false", () => {
    expect(sertifikasiSchema.parse({ nama: "Sertifikat A", statusAktif: "on" }).statusAktif).toBe(true);
    expect(sertifikasiSchema.parse({ nama: "Sertifikat A" }).statusAktif).toBe(false);
  });

  it("instansi: jenis harus 1–4", () => {
    expect(instansiSchema.safeParse({ nama: "Pemkot X", jenis: "2" }).success).toBe(true);
    expect(instansiSchema.safeParse({ nama: "Pemkot X", jenis: "9" }).success).toBe(false);
    expect(instansiSchema.safeParse({ nama: "Pemkot X", jenis: "" }).success).toBe(false);
  });

  it("jf: kode kosong → undefined; instansi wajib", () => {
    const r = jfSchema.parse({ instansi: "tok", kodeJf: "  ", namaJf: "Perencana" });
    expect(r.kodeJf).toBeUndefined();
    expect(jfSchema.safeParse({ instansi: "", namaJf: "Perencana" }).success).toBe(false);
  });

  it("jenjang: urutan 1–99, rumpun wajib & valid", () => {
    const base = { nama: "Muda", rumpun: "KEAHLIAN" };
    expect(jenjangSchema.safeParse({ ...base, urutan: "3" }).success).toBe(true);
    expect(jenjangSchema.safeParse({ ...base, urutan: "0" }).success).toBe(false);
    expect(jenjangSchema.safeParse({ ...base, urutan: "100" }).success).toBe(false);
    expect(jenjangSchema.safeParse({ nama: "Muda", urutan: "3" }).success).toBe(false);
    expect(jenjangSchema.safeParse({ ...base, rumpun: "LAIN", urutan: "3" }).success).toBe(false);
  });

  it("jenis: details dari JSON; JSON rusak ditolak", () => {
    const ok = jenisSchema.parse({
      namaJenis: "Teknis",
      details: JSON.stringify([{ namaDetail: "Umum", statusAktif: true }, { id: "abc", namaDetail: "Khusus", statusAktif: false }]),
    });
    expect(ok.details).toHaveLength(2);
    expect(jenisSchema.safeParse({ namaJenis: "Teknis", details: "{bukan json" }).success).toBe(false);
    expect(jenisSchema.safeParse({ namaJenis: "Teknis", details: JSON.stringify([{ namaDetail: "", statusAktif: true }]) }).success).toBe(false);
  });
});

describe("skema kompetensi", () => {
  it("semua field wajib; nama minimal 3 karakter", () => {
    const ok = { jf: "a", jenisDetail: "b", namaKompetensi: "Kompetensi dasar", statusAktif: "on" };
    expect(kompetensiSchema.safeParse(ok).success).toBe(true);
    expect(kompetensiSchema.safeParse({ ...ok, jf: "" }).success).toBe(false);
    expect(kompetensiSchema.safeParse({ ...ok, jenisDetail: "" }).success).toBe(false);
    expect(kompetensiSchema.safeParse({ ...ok, namaKompetensi: "ab" }).success).toBe(false);
  });
  it("token kompetensi tidak tertukar dengan jf", () => {
    const ids = createIds("salt-uji-minimal-16-karakter");
    const t = ids.encode("kompetensi", 5n);
    expect(ids.decode("kompetensi", t)).toBe(5n);
    expect(ids.decode("jf", t)).toBeNull();
  });
});

describe("skema program", () => {
  const ok = { jf: "a", jenisDetail: "b", namaProgram: "Program dasar", statusAktif: "on" };
  it("kategori opsional, hanya Wajib/Pilihan; deskripsi kosong → undefined", () => {
    expect(programSchema.safeParse(ok).success).toBe(true);
    expect(programSchema.safeParse({ ...ok, kategori: "" }).success).toBe(true);
    expect(programSchema.safeParse({ ...ok, kategori: "Wajib" }).success).toBe(true);
    expect(programSchema.safeParse({ ...ok, kategori: "Piihan" }).success).toBe(false);
    expect(programSchema.parse({ ...ok, deskripsi: "  " }).deskripsi).toBeUndefined();
  });
  it("token program tidak tertukar dengan kompetensi", () => {
    const ids = createIds("salt-uji-minimal-16-karakter");
    const t = ids.encode("program", 9n);
    expect(ids.decode("program", t)).toBe(9n);
    expect(ids.decode("kompetensi", t)).toBeNull();
  });
});

describe("shared helpers", () => {
  it("pageParams: batas aman", () => {
    expect(pageParams({})).toEqual({ page: 1, q: undefined });
    expect(pageParams({ page: "-5", q: "  abc " })).toEqual({ page: 1, q: "abc" });
    expect(pageParams({ page: "abc" }).page).toBe(1);
    expect(pageParams({ page: "999999999" }).page).toBe(100_000);
  });

  it("parseForm: gagal → AppError INVALID dengan fieldErrors", () => {
    try {
      parseForm(sertifikasiSchema, fd({ nama: "x" }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("INVALID");
      expect((e as AppError).fieldErrors?.nama).toBeDefined();
    }
  });

  it("conflictIfUsed: hanya melempar bila ada pemakai, pesan menyebut jumlah", () => {
    expect(() => conflictIfUsed("JF", [["kompetensi", 0]])).not.toThrow();
    try {
      conflictIfUsed("JF", [["kompetensi", 2], ["program", 0], ["penempatan", 1]]);
      expect.unreachable();
    } catch (e) {
      const err = e as AppError;
      expect(err.status).toBe(409);
      expect(err.message).toContain("2 kompetensi");
      expect(err.message).toContain("1 penempatan");
      expect(err.message).not.toContain("program");
    }
  });

  it("decodeOr404: token rusak → NOT_FOUND", () => {
    expect(() => decodeOr404("jf", "###")).toThrowError(AppError);
  });
});

describe("run()", () => {
  it("sukses → ok + data", async () => {
    expect(await run(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("AppError → hasil terstruktur tanpa melempar", async () => {
    const r = await run(async () => {
      throw new AppError("CONFLICT", 409, "Masih dipakai.", { nama: ["x"] });
    });
    expect(r).toMatchObject({ ok: false, code: "CONFLICT", message: "Masih dipakai." });
  });

  it("P2002/P2003 → pesan generik, tanpa detail DB", async () => {
    for (const code of ["P2002", "P2003"]) {
      const r = await run(async () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`nama`) tabel "Instansi"', {
          code,
          clientVersion: "x",
        });
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe("CONFLICT");
        expect(r.message).not.toMatch(/Instansi|nama|constraint/i);
      }
    }
  });

  it("pelanggaran RESTRICT (23001, error tak dikenal Prisma) → CONFLICT, tanpa detail DB", async () => {
    const r = await run(async () => {
      throw new Prisma.PrismaClientUnknownRequestError('code: "23001", message: "violates RESTRICT setting of foreign key constraint \\"X_fkey\\""', { clientVersion: "x" });
    });
    expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
    if (!r.ok) expect(r.message).not.toMatch(/X_fkey|23001/);
  });

  it("error tak dikenal → INTERNAL generik (tidak membocorkan message asli)", async () => {
    const r = await run(async () => {
      throw new Error('relation "secret_table" does not exist');
    });
    expect(r).toMatchObject({ ok: false, code: "INTERNAL" });
    if (!r.ok) expect(r.message).not.toContain("secret_table");
  });

  it("redirect()/notFound() Next dilempar ulang, bukan ditelan", async () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await expect(run(async () => { throw err; })).rejects.toBe(err);
  });
});

describe("ID publik: jenis entitas baru", () => {
  const ids = createIds("salt-uji-minimal-16-karakter");
  it("jenis / jenisDetail / sertifikasi tidak saling tertukar", () => {
    const t = ids.encode("jenisDetail", 12n);
    expect(ids.decode("jenisDetail", t)).toBe(12n);
    expect(ids.decode("jenis", t)).toBeNull();
    expect(ids.decode("sertifikasi", t)).toBeNull();
  });
});
