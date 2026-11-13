/** Tes integrasi unit organisasi/kerja (DB sungguhan). Dilewati bila TEST_DATABASE_URL tidak diset. Prefix "wtest-". */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "wtest-";
const TAG = `${PREFIX}${Date.now()}`;

describe.skipIf(!url)("unit organisasi & unit kerja (DB sungguhan)", () => {
  let db: typeof import("@/server/db").db;
  let ids: typeof import("@/server/ids").ids;
  let svc: typeof import("@/server/services/master/unit");
  let a: { id: bigint };
  let b: { id: bigint };
  let scopeA: import("@/server/auth/rbac").Scope;
  let scopeB: import("@/server/auth/rbac").Scope;
  const all = { kind: "all" } as const;

  async function cleanup() {
    await db.pegawaiPenempatan.deleteMany({ where: { pegawai: { nip: { startsWith: PREFIX } } } });
    await db.pegawai.deleteMany({ where: { nip: { startsWith: PREFIX } } });
    await db.unitKerja.deleteMany({ where: { kode: { startsWith: PREFIX } } });
    await db.unitOrganisasi.deleteMany({ where: { kode: { startsWith: PREFIX } } });
    await db.instansi.deleteMany({ where: { nama: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url!;
    process.env.DIRECT_URL = url!;
    ({ db } = await import("@/server/db"));
    ({ ids } = await import("@/server/ids"));
    svc = await import("@/server/services/master/unit");
    await cleanup();
    a = await db.instansi.create({ data: { nama: `${TAG}-A`, jenis: 2 } });
    b = await db.instansi.create({ data: { nama: `${TAG}-B`, jenis: 2 } });
    scopeA = { kind: "instansi", idInstansi: a.id };
    scopeB = { kind: "instansi", idInstansi: b.id };
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await cleanup();
    } finally {
      await db.$disconnect();
    }
  });

  const tI = (id: bigint) => ids().encode("instansi", id);
  const input = (idInst: bigint, kode: string, extra: object = {}) => ({ instansi: tI(idInst), kode: `${PREFIX}${kode}`, nama: `Unit ${kode}`, statusAktif: true, ...extra });

  it("admin instansi hanya bisa membuat unit di instansinya (instansi lain → 422)", async () => {
    await expect(svc.createUnitOrganisasi(input(b.id, "x1"), "t", scopeA)).rejects.toMatchObject({ status: 422 });
    await svc.createUnitOrganisasi(input(a.id, "o1"), "t", scopeA);
    expect(await db.unitOrganisasi.count({ where: { kode: `${PREFIX}o1` } })).toBe(1);
  });

  it("kode ganda dalam instansi yang sama (beda huruf besar-kecil) → 409; instansi lain boleh", async () => {
    await expect(svc.createUnitOrganisasi({ ...input(a.id, "o1"), kode: `${PREFIX}O1` }, "t", scopeA)).rejects.toMatchObject({ status: 409 });
    await svc.createUnitOrganisasi(input(b.id, "o1"), "t", scopeB);
  });

  it("daftar & ubah/hapus di luar scope → kosong / 404", async () => {
    const rowsB = (await svc.listUnitOrganisasi(scopeB, `${PREFIX}`, 1)).rows;
    expect(rowsB.every((r) => r.instansiNama === `${TAG}-B`)).toBe(true);
    const uoA = await db.unitOrganisasi.findFirstOrThrow({ where: { idInstansi: a.id, kode: `${PREFIX}o1` } });
    const tok = ids().encode("unitOrganisasi", uoA.id);
    await expect(svc.updateUnitOrganisasi(tok, input(b.id, "o1"), "t", scopeB)).rejects.toMatchObject({ status: 404 });
    await expect(svc.removeUnitOrganisasi(tok, "t", scopeB)).rejects.toMatchObject({ status: 404 });
  });

  it("unit kerja: unit organisasi harus satu instansi; hapus unit organisasi yang dipakai → 409", async () => {
    const uoA = await db.unitOrganisasi.findFirstOrThrow({ where: { idInstansi: a.id, kode: `${PREFIX}o1` } });
    const uoB = await db.unitOrganisasi.findFirstOrThrow({ where: { idInstansi: b.id, kode: `${PREFIX}o1` } });
    await expect(svc.createUnitKerja(input(a.id, "k1", { unitOrganisasi: ids().encode("unitOrganisasi", uoB.id) }), "t", all)).rejects.toMatchObject({ status: 422 });
    await svc.createUnitKerja(input(a.id, "k1", { unitOrganisasi: ids().encode("unitOrganisasi", uoA.id) }), "t", scopeA);
    await expect(svc.removeUnitOrganisasi(ids().encode("unitOrganisasi", uoA.id), "t", scopeA)).rejects.toMatchObject({ status: 409 });
  });

  it("unit kerja yang dipakai penempatan tidak bisa dihapus (409); tanpa pemakai bisa", async () => {
    const uk = await db.unitKerja.findFirstOrThrow({ where: { idInstansi: a.id, kode: `${PREFIX}k1` } });
    const peg = await db.pegawai.create({ data: { nip: `${PREFIX}${Date.now()}`, nama: "P" } });
    await db.pegawaiPenempatan.create({ data: { idPegawai: peg.id, idInstansi: a.id, idUnitKerja: uk.id, tglMulai: new Date("2020-01-01T00:00:00Z") } });
    const tok = ids().encode("unitKerja", uk.id);
    await expect(svc.removeUnitKerja(tok, "t", scopeA)).rejects.toMatchObject({ status: 409 });
    await db.pegawaiPenempatan.deleteMany({ where: { idPegawai: peg.id } });
    await svc.removeUnitKerja(tok, "t", scopeA);
    expect(await db.unitKerja.count({ where: { id: uk.id } })).toBe(0);
  });
});
