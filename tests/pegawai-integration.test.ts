/** Tes integrasi pegawai & referensi (DB sungguhan). Dilewati bila TEST_DATABASE_URL tidak diset. Prefix "xtest-". */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "xtest-";
const TAG = `${PREFIX}${Date.now()}`;

describe.skipIf(!url)("pegawai & referensi (DB sungguhan)", () => {
  let db: typeof import("@/server/db").db;
  let ids: typeof import("@/server/ids").ids;
  let svc: typeof import("@/server/services/pegawai");
  let ref: typeof import("@/server/services/master/ref-pegawai");
  let a: { id: bigint };
  let b: { id: bigint };
  let scopeA: import("@/server/auth/rbac").Scope;
  let scopeB: import("@/server/auth/rbac").Scope;
  const all = { kind: "all" } as const;

  async function cleanup() {
    await db.pegawaiPenempatan.deleteMany({ where: { pegawai: { nip: { startsWith: PREFIX } } } });
    await db.pegawai.deleteMany({ where: { nip: { startsWith: PREFIX } } });
    await db.jf.deleteMany({ where: { namaJf: { startsWith: PREFIX } } });
    await db.instansi.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.golongan.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.pendidikan.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.statusPegawai.deleteMany({ where: { nama: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url!;
    process.env.DIRECT_URL = url!;
    ({ db } = await import("@/server/db"));
    ({ ids } = await import("@/server/ids"));
    svc = await import("@/server/services/pegawai");
    ref = await import("@/server/services/master/ref-pegawai");
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
  const baru = (nip: string, instansi: bigint, extra: Record<string, unknown> = {}) => ({
    biodata: { nip: `${PREFIX}${nip}`, nama: `Pegawai ${nip}` } as never,
    penempatan: { instansi: tI(instansi), tglMulai: "2024-01-01", ...extra } as never,
  });
  const tP = async (nip: string) => ids().encode("pegawai", (await db.pegawai.findFirstOrThrow({ where: { nip: `${PREFIX}${nip}` } })).id);

  it("referensi: nama ganda (beda huruf) → 409; ganti nama ikut memperbarui pegawai; hapus yang dipakai → 409", async () => {
    const g = await ref.createRef("golongan", { nama: `${TAG}-III/a`, statusAktif: true }, "t");
    await expect(ref.createRef("golongan", { nama: `${TAG}-iii/A`, statusAktif: true }, "t")).rejects.toMatchObject({ status: 409 });
    await svc.createPegawai({ biodata: { nip: `${PREFIX}g1`, nama: "Gol Satu", golongan: `${TAG}-III/a` } as never, penempatan: baru("x", a.id).penempatan }, "t", all);
    await expect(ref.removeRef("golongan", g.id, "t")).rejects.toMatchObject({ status: 409 });
    await ref.updateRef("golongan", g.id, { nama: `${TAG}-III/b`, statusAktif: true }, "t");
    expect((await db.pegawai.findFirstOrThrow({ where: { nip: `${PREFIX}g1` } })).golongan).toBe(`${TAG}-III/b`);
  });

  it("nilai referensi harus ada di master → 422", async () => {
    await expect(svc.createPegawai({ biodata: { nip: `${PREFIX}g2`, nama: "Gol Dua", pendidikan: `${TAG}-tidak-ada` } as never, penempatan: baru("x", a.id).penempatan }, "t", all)).rejects.toMatchObject({ status: 422 });
    await expect(svc.createPegawai(baru("g3", a.id, { statusPegawai: `${TAG}-tidak-ada` }), "t", all)).rejects.toMatchObject({ status: 422 });
  });

  it("admin instansi hanya membuat pegawai di instansinya; NIP ganda → 409", async () => {
    await expect(svc.createPegawai(baru("p0", b.id), "t", scopeA)).rejects.toMatchObject({ status: 422 });
    await svc.createPegawai(baru("p1", a.id), "t", scopeA);
    await expect(svc.createPegawai(baru("p1", a.id), "t", all)).rejects.toMatchObject({ status: 409 });
    expect(await db.pegawaiPenempatan.count({ where: { pegawai: { nip: `${PREFIX}p1` }, tglSelesai: null } })).toBe(1);
  });

  it("daftar & detail terbatas scope; ubah/hapus pegawai instansi lain → 404", async () => {
    expect((await svc.listPegawai(scopeA, `${PREFIX}p1`, 1)).total).toBe(1);
    expect((await svc.listPegawai(scopeB, `${PREFIX}p1`, 1)).total).toBe(0);
    const tok = await tP("p1");
    await expect(svc.loadPegawaiDetail(tok, scopeB)).rejects.toMatchObject({ status: 404 });
    await expect(svc.updatePegawai(tok, { nip: `${PREFIX}p1`, nama: "X Y Z" } as never, "t", scopeB)).rejects.toMatchObject({ status: 404 });
    await expect(svc.removePegawai(tok, "t", scopeB)).rejects.toMatchObject({ status: 404 });
  });

  it("filter kolom menyaring (instansi, nama)", async () => {
    expect((await svc.listPegawai(all, undefined, 1, { nip: `${PREFIX}p1`, instansi: `${TAG}-A` })).total).toBe(1);
    expect((await svc.listPegawai(all, undefined, 1, { nip: `${PREFIX}p1`, instansi: `${TAG}-B` })).total).toBe(0);
    expect((await svc.listPegawai(all, undefined, 1, { nip: `${PREFIX}p1`, nama: "tidak-ada-nama" })).total).toBe(0);
  });

  it("mutasi: menutup penempatan lama sehari sebelumnya; tanggal tidak boleh mundur; riwayat utuh; satu aktif", async () => {
    const tok = await tP("p1");
    await expect(svc.mutasiPegawai(tok, { instansi: tI(a.id), tglMulai: "2023-01-01" } as never, "t", scopeA)).rejects.toMatchObject({ status: 422 });
    await svc.mutasiPegawai(tok, { instansi: tI(a.id), tglMulai: "2025-06-01", noSk: "SK-9" } as never, "t", scopeA);
    const d = await svc.loadPegawaiDetail(tok, scopeA);
    expect(d.riwayat).toHaveLength(2);
    expect(d.riwayat.filter((r) => r.aktif)).toHaveLength(1);
    expect(d.riwayat.find((r) => !r.aktif)?.selesai).toBe("2025-05-31");
  });

  it("hapus pegawai: ikut menghapus penempatan; terhubung akun → 409", async () => {
    await svc.createPegawai(baru("p2", a.id), "t", all);
    await svc.removePegawai(await tP("p2"), "t", all);
    expect(await db.pegawai.count({ where: { nip: `${PREFIX}p2` } })).toBe(0);

    const u = await db.user.create({ data: { username: `${TAG}-u`, nama: "U" } });
    try {
      await svc.createPegawai(baru("p3", a.id), "t", all);
      await db.pegawai.update({ where: { nip: `${PREFIX}p3` }, data: { idUser: u.id } });
      await expect(svc.removePegawai(await tP("p3"), "t", all)).rejects.toMatchObject({ status: 409 });
    } finally {
      await db.pegawaiPenempatan.deleteMany({ where: { pegawai: { nip: `${PREFIX}p3` } } });
      await db.pegawai.deleteMany({ where: { nip: `${PREFIX}p3` } });
      await db.user.delete({ where: { id: u.id } });
    }
  });
});
