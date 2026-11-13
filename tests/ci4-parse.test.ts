import { describe, expect, it } from "vitest";
import { agama, dateOnly, timestamp, jenisKelamin, parseDump, rumpunDariNama, stripDeleted } from "@/server/migrate/ci4-parse";

const SQL = `
CREATE TABLE public.m_x (
    id bigint NOT NULL,
    nama character varying(50) NOT NULL,
    ok boolean DEFAULT true NOT NULL,
    n smallint,
    CONSTRAINT m_x_check CHECK ((n > 0))
);

INSERT INTO public.m_x VALUES (1, 'Dinas ''A'', (Baru)', true, NULL);
INSERT INTO public.m_x VALUES (2, 'baris
dua', false, 7);
`;

describe("parser dump CI4", () => {
  it("kolom dari CREATE TABLE, CONSTRAINT dilewati", () => {
    expect(parseDump(SQL).columns.m_x).toEqual(["id", "nama", "ok", "n"]);
  });
  it("kutip ganda, koma/kurung dalam string, NULL, boolean, angka, baris ganda", () => {
    const r = parseDump(SQL).rows.m_x!;
    expect(r[0]).toEqual({ id: 1, nama: "Dinas 'A', (Baru)", ok: true, n: null });
    expect(r[1]).toEqual({ id: 2, nama: "baris\ndua", ok: false, n: 7 });
  });
  it("jumlah nilai tak cocok → galat", () => {
    expect(() => parseDump(SQL.replace("false, 7", "false"))).toThrow(/nilai/);
  });
});

describe("pemetaan", () => {
  it("jenis kelamin, agama, tanggal, sufiks Deleted, rumpun", () => {
    expect(jenisKelamin(1)).toBe("L");
    expect(jenisKelamin(2)).toBe("P");
    expect(jenisKelamin(null)).toBeNull();
    expect(agama(1)).toBe("Islam");
    expect(agama(null)).toBeNull();
    expect(dateOnly("2020-05-01")?.toISOString()).toBe("2020-05-01T00:00:00.000Z");
    expect(dateOnly(null)).toBeNull();
    expect(timestamp("2026-07-13 00:42:25+00")?.toISOString()).toBe("2026-07-13T00:42:25.000Z");
    expect(timestamp("2026-07-13 07:42:25+07")?.toISOString()).toBe("2026-07-13T00:42:25.000Z");
    expect(timestamp(null)).toBeNull();
    expect(timestamp("bukan tanggal")).toBeNull();
    expect(stripDeleted("PNS (Deleted 1783999537)")).toBe("PNS");
    expect(rumpunDariNama("Ahli Muda")).toBe("KEAHLIAN");
    expect(rumpunDariNama("Terampil")).toBe("KETERAMPILAN");
    expect(rumpunDariNama("Lain")).toBeNull();
  });
});
