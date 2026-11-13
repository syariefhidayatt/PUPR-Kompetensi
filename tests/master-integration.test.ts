/**
 * Tes integrasi guard 409 & anti-IDOR. Menulis ke DB sungguhan → WAJIB DB khusus tes
 * (mis. branch Neon "test"). Dilewati bila TEST_DATABASE_URL tidak diset.
 *
 *   TEST_DATABASE_URL=postgresql://... npm test
 *
 * Skema harus sudah dimigrasi (prisma migrate deploy) ke DB tersebut.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "itest-";
const TAG = `${PREFIX}${Date.now()}`;

describe.skipIf(!url)("master: guard 409 & IDOR (DB sungguhan)", () => {
  let db: typeof import("@/server/db").db;
  let ids: typeof import("@/server/ids").ids;
  let svc: {
    instansi: typeof import("@/server/services/master/instansi");
    jf: typeof import("@/server/services/master/jf");
    jenjang: typeof import("@/server/services/master/jenjang");
    sertifikasi: typeof import("@/server/services/master/sertifikasi");
    jenis: typeof import("@/server/services/master/jenis-kompetensi");
    kompetensi: typeof import("@/server/services/master/kompetensi");
    program: typeof import("@/server/services/master/program-bangkom");
    pelatihan: typeof import("@/server/services/master/pelatihan");
    refresh: typeof import("@/server/services/pelatihan-refresh");
    matriks: typeof import("@/server/services/matriks");
    lp: typeof import("@/server/services/learning-path");
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url!; // sebelum modul db diimpor
    process.env.DIRECT_URL = url!;
    ({ db } = await import("@/server/db"));
    ({ ids } = await import("@/server/ids"));
    svc = {
      instansi: await import("@/server/services/master/instansi"),
      jf: await import("@/server/services/master/jf"),
      jenjang: await import("@/server/services/master/jenjang"),
      sertifikasi: await import("@/server/services/master/sertifikasi"),
      jenis: await import("@/server/services/master/jenis-kompetensi"),
      kompetensi: await import("@/server/services/master/kompetensi"),
      program: await import("@/server/services/master/program-bangkom"),
      pelatihan: await import("@/server/services/master/pelatihan"),
      refresh: await import("@/server/services/pelatihan-refresh"),
      matriks: await import("@/server/services/matriks"),
      lp: await import("@/server/services/learning-path"),
    };
    await cleanup();
  });

  // Bersihkan semua data tes (termasuk sisa run yang gagal) berdasarkan prefix.
  async function cleanup() {
    const pelPrefix = { pelatihan: { namaPelatihan: { startsWith: PREFIX } } };
    await db.pelatihanPesertaBatch.deleteMany({ where: { batch: pelPrefix } });
    await db.pelatihanBatch.deleteMany({ where: pelPrefix });
    await db.pelatihanUsulan.deleteMany({ where: pelPrefix });
    await db.pegawaiPenempatan.deleteMany({ where: { pegawai: { nip: { startsWith: PREFIX } } } });
    await db.pegawai.deleteMany({ where: { nip: { startsWith: PREFIX } } });
    await db.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
    await db.pelatihan.deleteMany({ where: { namaPelatihan: { startsWith: PREFIX } } }); // pivot ikut terhapus (cascade)
    await db.programBangkom.deleteMany({ where: { namaProgram: { startsWith: PREFIX } } });
    await db.kompetensi.deleteMany({ where: { namaKompetensi: { startsWith: PREFIX } } });
    await db.jf.deleteMany({ where: { namaJf: { startsWith: PREFIX } } });
    await db.instansi.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.jenisKompetensiDetail.deleteMany({ where: { jenis: { namaJenis: { startsWith: PREFIX } } } });
    await db.jenisKompetensi.deleteMany({ where: { namaJenis: { startsWith: PREFIX } } });
    await db.sertifikasi.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.jenjangJabatan.deleteMany({ where: { nama: { startsWith: PREFIX } } });
  }

  afterAll(async () => {
    if (!db) return;
    try {
      await cleanup();
    } finally {
      await db.$disconnect();
    }
  });

  const details = (...n: string[]) => n.map((namaDetail) => ({ namaDetail, statusAktif: true }));

  it("jenis: buat → ubah → hapus (jalur sukses)", async () => {
    await svc.jenis.createJenis({ namaJenis: `${TAG}-A`, statusAktif: true, details: details("x", "y") }, "t");
    const row = await db.jenisKompetensi.findFirstOrThrow({ where: { namaJenis: `${TAG}-A` }, include: { details: true } });
    expect(row.details).toHaveLength(2);
    const token = ids().encode("jenis", row.id);
    const keep = row.details[0]!;
    await svc.jenis.updateJenis(
      token,
      { namaJenis: `${TAG}-A2`, statusAktif: true, details: [{ id: ids().encode("jenisDetail", keep.id), namaDetail: "x2", statusAktif: true }] },
      "t",
    );
    const after = await db.jenisKompetensi.findUniqueOrThrow({ where: { id: row.id }, include: { details: true } });
    expect(after.details).toHaveLength(1);
    await svc.jenis.removeJenis(token, "t");
    expect(await db.jenisKompetensi.count({ where: { id: row.id } })).toBe(0);
  });

  it("nama jenis kembar (beda huruf besar/kecil) ditolak 409", async () => {
    await svc.jenis.createJenis({ namaJenis: `${TAG}-Dup`, statusAktif: true, details: [] }, "t");
    await expect(
      svc.jenis.createJenis({ namaJenis: `${TAG}-DUP`, statusAktif: true, details: [] }, "t"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("IDOR: sub jenis milik jenis lain tidak bisa disisipkan lewat update", async () => {
    await svc.jenis.createJenis({ namaJenis: `${TAG}-B1`, statusAktif: true, details: details("b1") }, "t");
    await svc.jenis.createJenis({ namaJenis: `${TAG}-B2`, statusAktif: true, details: details("b2") }, "t");
    const b1 = await db.jenisKompetensi.findFirstOrThrow({ where: { namaJenis: `${TAG}-B1` } });
    const b2 = await db.jenisKompetensi.findFirstOrThrow({ where: { namaJenis: `${TAG}-B2` }, include: { details: true } });
    const foreign = ids().encode("jenisDetail", b2.details[0]!.id);
    await expect(
      svc.jenis.updateJenis(
        ids().encode("jenis", b1.id),
        { namaJenis: `${TAG}-B1`, statusAktif: true, details: [{ id: foreign, namaDetail: "diretas", statusAktif: true }] },
        "t",
      ),
    ).rejects.toMatchObject({ status: 404 });
    const still = await db.jenisKompetensiDetail.findUniqueOrThrow({ where: { id: b2.details[0]!.id } });
    expect(still.namaDetail).toBe("b2");
  });

  it("instansi yang dipakai JF tidak bisa dihapus; setelah JF dihapus bisa", async () => {
    await svc.instansi.createInstansi({ nama: `${TAG}-Ins`, jenis: 2, statusAktif: true }, "t");
    const ins = await db.instansi.findFirstOrThrow({ where: { nama: `${TAG}-Ins` } });
    const insToken = ids().encode("instansi", ins.id);
    await db.jf.create({ data: { idInstansi: ins.id, namaJf: `${TAG}-JF`, statusAktif: true } });
    await expect(svc.instansi.removeInstansi(insToken, "t")).rejects.toMatchObject({ status: 409 });
    const jf = await db.jf.findFirstOrThrow({ where: { namaJf: `${TAG}-JF` } });
    await svc.jf.removeJf(ids().encode("jf", jf.id), "t");
    await svc.instansi.removeInstansi(insToken, "t");
    expect(await db.instansi.count({ where: { id: ins.id } })).toBe(0);
  });

  it("jenjang: urutan boleh kembar (dua rumpun), nama kembar ditolak", async () => {
    await svc.jenjang.createJenjang({ nama: `${TAG}-J1`, rumpun: "KEAHLIAN", urutan: 1, statusAktif: true }, "t");
    await svc.jenjang.createJenjang({ nama: `${TAG}-J2`, rumpun: "KEAHLIAN", urutan: 1, statusAktif: true }, "t");
    await expect(
      svc.jenjang.createJenjang({ nama: `${TAG}-j1`, rumpun: "KEAHLIAN", urutan: 2, statusAktif: true }, "t"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("sertifikasi: CRUD dasar", async () => {
    await svc.sertifikasi.createSertifikasi({ nama: `${TAG}-S`, statusAktif: true }, "t");
    const s = await db.sertifikasi.findFirstOrThrow({ where: { nama: `${TAG}-S` } });
    await svc.sertifikasi.removeSertifikasi(ids().encode("sertifikasi", s.id), "t");
    expect(await db.sertifikasi.count({ where: { id: s.id } })).toBe(0);
  });

  describe("kompetensi: scope instansi & guard", () => {
    type Scope = import("@/server/auth/rbac").Scope;
    let a: { id: bigint }, b: { id: bigint }, jfA: { id: bigint }, jfB: { id: bigint }, det: { id: bigint };
    let scopeA: Scope;
    const all: Scope = { kind: "all" };
    const tok = (id: bigint) => ids().encode("kompetensi", id);
    const input = (jf: bigint, nama: string, aktif = true) => ({
      jf: ids().encode("jf", jf),
      jenisDetail: ids().encode("jenisDetail", det.id),
      namaKompetensi: nama,
      statusAktif: aktif,
    });

    beforeAll(async () => {
      a = await db.instansi.create({ data: { nama: `${TAG}-KA`, jenis: 2 } });
      b = await db.instansi.create({ data: { nama: `${TAG}-KB`, jenis: 2 } });
      jfA = await db.jf.create({ data: { idInstansi: a.id, namaJf: `${TAG}-JFA` } });
      jfB = await db.jf.create({ data: { idInstansi: b.id, namaJf: `${TAG}-JFB` } });
      const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-KJ`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
      det = jenis.details[0]!;
      scopeA = { kind: "instansi", idInstansi: a.id };
    });

    it("buat di JF sendiri OK; nama kembar (beda huruf besar/kecil) 409", async () => {
      await svc.kompetensi.createKompetensi(input(jfA.id, `${TAG}-K1`), "t", scopeA);
      await expect(
        svc.kompetensi.createKompetensi(input(jfA.id, `${TAG}-k1`), "t", scopeA),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("admin instansi tidak bisa membuat kompetensi di JF instansi lain (422)", async () => {
      await expect(
        svc.kompetensi.createKompetensi(input(jfB.id, `${TAG}-K2`), "t", scopeA),
      ).rejects.toMatchObject({ status: 422 });
      expect(await db.kompetensi.count({ where: { namaKompetensi: `${TAG}-K2` } })).toBe(0);
    });

    it("IDOR: ubah/hapus kompetensi instansi lain → 404 dan data tidak berubah", async () => {
      await svc.kompetensi.createKompetensi(input(jfB.id, `${TAG}-K3`), "t", all);
      const k3 = await db.kompetensi.findFirstOrThrow({ where: { namaKompetensi: `${TAG}-K3` } });
      await expect(
        svc.kompetensi.updateKompetensi(tok(k3.id), input(jfA.id, `${TAG}-K3x`), "t", scopeA),
      ).rejects.toMatchObject({ status: 404 });
      await expect(svc.kompetensi.removeKompetensi(tok(k3.id), "t", scopeA)).rejects.toMatchObject({ status: 404 });
      const still = await db.kompetensi.findUniqueOrThrow({ where: { id: k3.id } });
      expect(still.idJf).toBe(jfB.id);
      expect(still.namaKompetensi).toBe(`${TAG}-K3`);
    });

    it("tidak boleh memindahkan kompetensi sendiri ke JF instansi lain", async () => {
      const k1 = await db.kompetensi.findFirstOrThrow({ where: { namaKompetensi: `${TAG}-K1` } });
      await expect(
        svc.kompetensi.updateKompetensi(tok(k1.id), input(jfB.id, `${TAG}-K1`), "t", scopeA),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("hapus ditolak 409 bila dipakai pelatihan; bisa setelah pelatihan dihapus", async () => {
      await svc.kompetensi.createKompetensi(input(jfA.id, `${TAG}-K4`), "t", scopeA);
      const k4 = await db.kompetensi.findFirstOrThrow({ where: { namaKompetensi: `${TAG}-K4` } });
      const prog = await db.programBangkom.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaProgram: `${TAG}-P` } });
      const pel = await db.pelatihan.create({
        data: { idProgram: prog.id, namaPelatihan: `${TAG}-L`, kompetensi: { create: { idKompetensi: k4.id } } },
      });
      await expect(svc.kompetensi.removeKompetensi(tok(k4.id), "t", scopeA)).rejects.toMatchObject({ status: 409 });
      await db.pelatihan.delete({ where: { id: pel.id } });
      await svc.kompetensi.removeKompetensi(tok(k4.id), "t", scopeA);
      expect(await db.kompetensi.count({ where: { id: k4.id } })).toBe(0);
    });
  });

  describe("program bangkom: scope instansi & guard", () => {
    type Scope = import("@/server/auth/rbac").Scope;
    let a: { id: bigint }, b: { id: bigint }, jfA: { id: bigint }, jfB: { id: bigint }, det: { id: bigint };
    let scopeA: Scope;
    const all: Scope = { kind: "all" };
    const tok = (id: bigint) => ids().encode("program", id);
    const input = (jf: bigint, nama: string, kategori?: "Wajib" | "Pilihan") => ({
      jf: ids().encode("jf", jf),
      jenisDetail: ids().encode("jenisDetail", det.id),
      namaProgram: nama,
      kategori,
      statusAktif: true,
    });

    beforeAll(async () => {
      a = await db.instansi.create({ data: { nama: `${TAG}-PA`, jenis: 2 } });
      b = await db.instansi.create({ data: { nama: `${TAG}-PB`, jenis: 2 } });
      jfA = await db.jf.create({ data: { idInstansi: a.id, namaJf: `${TAG}-PJFA` } });
      jfB = await db.jf.create({ data: { idInstansi: b.id, namaJf: `${TAG}-PJFB` } });
      const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-PJ`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
      det = jenis.details[0]!;
      scopeA = { kind: "instansi", idInstansi: a.id };
    });

    it("buat OK; nama kembar beda huruf besar/kecil 409; JF instansi lain 422", async () => {
      await svc.program.createProgram(input(jfA.id, `${TAG}-P1`, "Wajib"), "t", scopeA);
      await expect(svc.program.createProgram(input(jfA.id, `${TAG}-p1`), "t", scopeA)).rejects.toMatchObject({ status: 409 });
      await expect(svc.program.createProgram(input(jfB.id, `${TAG}-P2`), "t", scopeA)).rejects.toMatchObject({ status: 422 });
    });

    it("IDOR: ubah/hapus program instansi lain → 404, data utuh", async () => {
      await svc.program.createProgram(input(jfB.id, `${TAG}-P3`), "t", all);
      const p3 = await db.programBangkom.findFirstOrThrow({ where: { namaProgram: `${TAG}-P3` } });
      await expect(svc.program.updateProgram(tok(p3.id), input(jfA.id, `${TAG}-P3x`), "t", scopeA)).rejects.toMatchObject({ status: 404 });
      await expect(svc.program.removeProgram(tok(p3.id), "t", scopeA)).rejects.toMatchObject({ status: 404 });
      expect((await db.programBangkom.findUniqueOrThrow({ where: { id: p3.id } })).idJf).toBe(jfB.id);
    });

    it("hapus ditolak 409 bila dipakai pelatihan; bisa setelah pelatihan dihapus", async () => {
      await svc.program.createProgram(input(jfA.id, `${TAG}-P4`), "t", scopeA);
      const p4 = await db.programBangkom.findFirstOrThrow({ where: { namaProgram: `${TAG}-P4` } });
      const pel = await db.pelatihan.create({ data: { idProgram: p4.id, namaPelatihan: `${TAG}-L2` } });
      await expect(svc.program.removeProgram(tok(p4.id), "t", scopeA)).rejects.toMatchObject({ status: 409 });
      await db.pelatihan.delete({ where: { id: pel.id } });
      await svc.program.removeProgram(tok(p4.id), "t", scopeA);
      expect(await db.programBangkom.count({ where: { id: p4.id } })).toBe(0);
    });
  });

  describe("pelatihan: pivot, scope, refresh", () => {
    type Scope = import("@/server/auth/rbac").Scope;
    let a: { id: bigint }, b: { id: bigint }, jfA: { id: bigint }, jfB: { id: bigint }, det: { id: bigint };
    let progA: { id: bigint }, kA: { id: bigint }, kB: { id: bigint }, j1: { id: bigint }, j2: { id: bigint }, s1: { id: bigint };
    let scopeA: Scope, scopeB: Scope;
    const all: Scope = { kind: "all" };
    const tk = (id: bigint) => ids().encode("pelatihan", id);

    const input = (over: Partial<import("@/lib/schemas/master").PelatihanInput> = {}): import("@/lib/schemas/master").PelatihanInput => ({
      program: ids().encode("program", progA.id),
      namaPelatihan: `${TAG}-PL`,
      deskripsi: undefined,
      jenisPelatihan: "Mutlak",
      kategoriPelatihan: "Dasar",
      isPeriode: false,
      kPeriode: undefined,
      isRefreshment: false,
      kRefreshment: undefined,
      isSertifikat: false,
      statusAktif: true,
      jenjang: [ids().encode("jenjang", j1.id)],
      kompetensi: [ids().encode("kompetensi", kA.id)],
      sertifikasi: [],
      ...over,
    });
    const pivots = async (id: bigint) => ({
      jenjang: await db.pelatihanJenjang.count({ where: { idPelatihan: id } }),
      kompetensi: await db.pelatihanKompetensi.count({ where: { idPelatihan: id } }),
      sertifikasi: await db.pelatihanSertifikasi.count({ where: { idPelatihan: id } }),
    });

    beforeAll(async () => {
      a = await db.instansi.create({ data: { nama: `${TAG}-LA`, jenis: 2 } });
      b = await db.instansi.create({ data: { nama: `${TAG}-LB`, jenis: 2 } });
      jfA = await db.jf.create({ data: { idInstansi: a.id, namaJf: `${TAG}-LJFA` } });
      jfB = await db.jf.create({ data: { idInstansi: b.id, namaJf: `${TAG}-LJFB` } });
      const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-LJ`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
      det = jenis.details[0]!;
      progA = await db.programBangkom.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaProgram: `${TAG}-LP` } });
      kA = await db.kompetensi.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaKompetensi: `${TAG}-LKA` } });
      kB = await db.kompetensi.create({ data: { idJf: jfB.id, idJenisDetail: det.id, namaKompetensi: `${TAG}-LKB` } });
      j1 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-LJ1`, urutan: 1 } });
      j2 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-LJ2`, urutan: 2 } });
      s1 = await db.sertifikasi.create({ data: { nama: `${TAG}-LS1` } });
      scopeA = { kind: "instansi", idInstansi: a.id };
      scopeB = { kind: "instansi", idInstansi: b.id };
    });

    it("buat: semua field + 3 pivot tersimpan; daftar menampilkan 'dibuka lagi'", async () => {
      await svc.pelatihan.createPelatihan(
        input({
          namaPelatihan: `${TAG}-PL1`,
          isPeriode: true, kPeriode: 2026, isRefreshment: true, kRefreshment: 5,
          isSertifikat: true, sertifikasi: [ids().encode("sertifikasi", s1.id)],
          jenjang: [ids().encode("jenjang", j1.id), ids().encode("jenjang", j2.id)],
          deskripsi: "uraian",
        }),
        "t",
        scopeA,
      );
      const row = await db.pelatihan.findFirstOrThrow({ where: { namaPelatihan: `${TAG}-PL1` } });
      expect(row).toMatchObject({ isPeriode: true, kPeriode: 2026, isRefreshment: true, kRefreshment: 5, isSertifikat: true, deskripsi: "uraian", jenisPelatihan: "Mutlak", kategoriPelatihan: "Dasar", createdBy: "t" });
      expect(await pivots(row.id)).toEqual({ jenjang: 2, kompetensi: 1, sertifikasi: 1 });
      const list = await svc.pelatihan.listPelatihan(scopeA, `${TAG}-PL1`, undefined, 1);
      expect(list.total).toBe(1);
      expect(list.rows[0]).toMatchObject({ dibukaLagi: 2031 });
    });

    it("kompetensi dari JF lain, atau program instansi lain → 422; tidak ada yang tersimpan", async () => {
      await expect(
        svc.pelatihan.createPelatihan(input({ namaPelatihan: `${TAG}-PL2`, kompetensi: [ids().encode("kompetensi", kB.id)] }), "t", all),
      ).rejects.toMatchObject({ status: 422 });
      await expect(svc.pelatihan.createPelatihan(input({ namaPelatihan: `${TAG}-PL2` }), "t", scopeB)).rejects.toMatchObject({ status: 422 });
      expect(await db.pelatihan.count({ where: { namaPelatihan: `${TAG}-PL2` } })).toBe(0);
    });

    it("ubah: pivot diganti penuh; ubah gagal tidak merusak pivot lama", async () => {
      await svc.pelatihan.createPelatihan(input({ namaPelatihan: `${TAG}-PL3`, jenjang: [ids().encode("jenjang", j1.id), ids().encode("jenjang", j2.id)] }), "t", scopeA);
      const r = await db.pelatihan.findFirstOrThrow({ where: { namaPelatihan: `${TAG}-PL3` } });
      await svc.pelatihan.updatePelatihan(tk(r.id), input({ namaPelatihan: `${TAG}-PL3`, jenjang: [ids().encode("jenjang", j2.id)], isSertifikat: true, sertifikasi: [ids().encode("sertifikasi", s1.id)] }), "u", scopeA);
      expect(await pivots(r.id)).toEqual({ jenjang: 1, kompetensi: 1, sertifikasi: 1 });
      expect((await db.pelatihan.findUniqueOrThrow({ where: { id: r.id } })).updatedBy).toBe("u");
      await expect(
        svc.pelatihan.updatePelatihan(tk(r.id), input({ namaPelatihan: `${TAG}-PL3-x`, kompetensi: [ids().encode("kompetensi", kB.id)] }), "u", scopeA),
      ).rejects.toMatchObject({ status: 422 });
      expect(await pivots(r.id)).toEqual({ jenjang: 1, kompetensi: 1, sertifikasi: 1 });
      expect((await db.pelatihan.findUniqueOrThrow({ where: { id: r.id } })).namaPelatihan).toBe(`${TAG}-PL3`);
    });

    it("IDOR: instansi lain tidak bisa mengubah/menghapus; hapus sendiri membersihkan pivot", async () => {
      const r = await db.pelatihan.findFirstOrThrow({ where: { namaPelatihan: `${TAG}-PL3` } });
      await expect(svc.pelatihan.updatePelatihan(tk(r.id), input(), "x", scopeB)).rejects.toMatchObject({ status: 404 });
      await expect(svc.pelatihan.removePelatihan(tk(r.id), "x", scopeB)).rejects.toMatchObject({ status: 404 });
      await svc.pelatihan.removePelatihan(tk(r.id), "t", scopeA);
      expect(await db.pelatihan.count({ where: { id: r.id } })).toBe(0);
      expect(await pivots(r.id)).toEqual({ jenjang: 0, kompetensi: 0, sertifikasi: 0 });
    });

    it("cron refresh: membuka lagi pelatihan jatuh tempo, idempoten, tidak menyentuh yang belum", async () => {
      // Tahun 2005/2006 sengaja jauh di masa lalu agar data nyata di branch tidak ikut terkena.
      const due = await db.pelatihan.create({ data: { idProgram: progA.id, namaPelatihan: `${TAG}-R1`, isRefreshment: true, isPeriode: true, kPeriode: 2005, kRefreshment: 1, statusAktif: false } });
      const notDue = await db.pelatihan.create({ data: { idProgram: progA.id, namaPelatihan: `${TAG}-R2`, isRefreshment: true, isPeriode: true, kPeriode: 2006, kRefreshment: 3, statusAktif: false } });
      const noFlag = await db.pelatihan.create({ data: { idProgram: progA.id, namaPelatihan: `${TAG}-R3`, isRefreshment: false, isPeriode: true, kPeriode: 2005, kRefreshment: 1, statusAktif: false } });

      const first = await svc.refresh.refreshPelatihan(2006, "cron-test");
      expect(first.ids).toContain(String(due.id));
      expect(first.ids).not.toContain(String(notDue.id));
      expect(first.ids).not.toContain(String(noFlag.id));
      const after = await db.pelatihan.findUniqueOrThrow({ where: { id: due.id } });
      expect(after).toMatchObject({ kPeriode: 2006, statusAktif: true, updatedBy: "cron-test" });

      const second = await svc.refresh.refreshPelatihan(2006, "cron-test");
      expect(second.ids).not.toContain(String(due.id));
      expect((await db.pelatihan.findUniqueOrThrow({ where: { id: notDue.id } })).statusAktif).toBe(false);
      expect((await db.pelatihan.findUniqueOrThrow({ where: { id: noFlag.id } })).statusAktif).toBe(false);
      expect(await db.auditLog.count({ where: { aksi: "refresh", actor: "cron-test" } })).toBeGreaterThanOrEqual(1);
    });
  });

  describe("matriks: scope & isi", () => {
    type Scope = import("@/server/auth/rbac").Scope;
    let a: { id: bigint }, b: { id: bigint }, jfA: { id: bigint }, jfB: { id: bigint };
    let scopeA: Scope;
    const all: Scope = { kind: "all" };

    beforeAll(async () => {
      a = await db.instansi.create({ data: { nama: `${TAG}-MA`, jenis: 2 } });
      b = await db.instansi.create({ data: { nama: `${TAG}-MB`, jenis: 2 } });
      jfA = await db.jf.create({ data: { idInstansi: a.id, namaJf: `${TAG}-MJFA` } });
      jfB = await db.jf.create({ data: { idInstansi: b.id, namaJf: `${TAG}-MJFB` } });
      const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-MJ`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
      const det = jenis.details[0]!;
      const k1 = await db.kompetensi.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaKompetensi: `${TAG}-MK1` } });
      await db.kompetensi.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaKompetensi: `${TAG}-MK2` } }); // gap
      await db.kompetensi.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaKompetensi: `${TAG}-MK3`, statusAktif: false } }); // nonaktif: tidak ikut
      const jen = await db.jenjangJabatan.create({ data: { nama: `${TAG}-MJN`, urutan: 1, rumpun: "KETERAMPILAN" } });
      const prog = await db.programBangkom.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaProgram: `${TAG}-MP` } });
      await db.pelatihan.create({
        data: {
          idProgram: prog.id, namaPelatihan: `${TAG}-MPL`, kategoriPelatihan: "Dasar", isSertifikat: true,
          kompetensi: { create: { idKompetensi: k1.id } }, jenjang: { create: { idJenjang: jen.id } },
        },
      });
      await db.pelatihan.create({ // nonaktif: tidak dihitung
        data: { idProgram: prog.id, namaPelatihan: `${TAG}-MPL2`, statusAktif: false, kompetensi: { create: { idKompetensi: k1.id } }, jenjang: { create: { idJenjang: jen.id } } },
      });
      scopeA = { kind: "instansi", idInstansi: a.id };
    });

    it("isi matriks: pelatihan aktif di sel yang benar, kompetensi nonaktif tidak ikut, gap terhitung", async () => {
      const v = await svc.matriks.loadMatriks(scopeA, ids().encode("jf", jfA.id));
      const d = v.data!;
      expect(d.summary).toEqual({ total: 2, tercakup: 1, gap: 1 });
      // Kolom = semua jenjang aktif pada rumpun yang dipakai JF (Keterampilan); rumpun lain (Keahlian) tidak muncul.
      expect(d.jenjang.map((j) => j.nama)).toContain(`${TAG}-MJN`);
      expect(d.jenjang.every((j) => j.rumpun === "Keterampilan")).toBe(true);
      const col = d.jenjang.findIndex((j) => j.nama === `${TAG}-MJN`);
      const k1 = d.rows.find((r) => r.nama === `${TAG}-MK1`)!;
      expect(k1.cells[col]!.map((p) => p.nama)).toEqual([`${TAG}-MPL`]); // MPL2 nonaktif tidak ikut
      expect(k1.cells[col]![0]).toMatchObject({ kategori: "Dasar", sertifikat: true });
      expect(k1.cells.filter((_, i) => i !== col).every((c) => c.length === 0)).toBe(true);
      expect(d.rows.find((r) => r.nama === `${TAG}-MK2`)!.gap).toBe(true);
      expect(d.rows.some((r) => r.nama === `${TAG}-MK3`)).toBe(false);
    });

    it("JF instansi lain → 404; admin pusat boleh; JF tanpa data → matriks kosong tanpa error", async () => {
      await expect(svc.matriks.loadMatriks(scopeA, ids().encode("jf", jfB.id))).rejects.toMatchObject({ status: 404 });
      await expect(svc.matriks.loadMatriks(scopeA, "###")).rejects.toMatchObject({ status: 404 });
      const v = await svc.matriks.loadMatriks(all, ids().encode("jf", jfB.id));
      expect(v.data!.summary).toEqual({ total: 0, tercakup: 0, gap: 0 });
    });

    it("tanpa token → JF pertama dalam scope", async () => {
      const v = await svc.matriks.loadMatriks(scopeA, undefined);
      expect(v.selected).toBe(ids().encode("jf", jfA.id));
    });
  });

  describe("learning path: status, scope, usulan", () => {
    type Scope = import("@/server/auth/rbac").Scope;
    let a: { id: bigint }, b: { id: bigint }, jfA: { id: bigint }, jfB: { id: bigint };
    let uA: { id: bigint }, pgA: { id: bigint }, pgB: { id: bigint }, pgC: { id: bigint };
    let pel1: { id: bigint }, pel2: { id: bigint }, pel3: { id: bigint };
    let scopeA: Scope;
    const tok = (id: bigint) => ids().encode("pegawai", id);
    const d = (s: string) => new Date(s);

    beforeAll(async () => {
      a = await db.instansi.create({ data: { nama: `${TAG}-NA`, jenis: 2 } });
      b = await db.instansi.create({ data: { nama: `${TAG}-NB`, jenis: 2 } });
      jfA = await db.jf.create({ data: { idInstansi: a.id, namaJf: `${TAG}-NJFA` } });
      jfB = await db.jf.create({ data: { idInstansi: b.id, namaJf: `${TAG}-NJFB` } });
      const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-NJ`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
      const det = jenis.details[0]!;
      const prog = await db.programBangkom.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaProgram: `${TAG}-NP` } });
      const j1 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-NJ1`, urutan: 1 } });
      const j2 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-NJ2`, urutan: 2 } });
      const j3 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-NJ3`, urutan: 3 } });
      const mk = (nama: string, jenjang: bigint[], extra = {}) =>
        db.pelatihan.create({ data: { idProgram: prog.id, namaPelatihan: `${TAG}-${nama}`, ...extra, jenjang: { create: jenjang.map((idJenjang) => ({ idJenjang })) } } });
      pel1 = await mk("NL1", [j1.id, j2.id, j3.id]);
      pel2 = await mk("NL2", [j1.id]);
      pel3 = await mk("NL3", [j2.id], { isRefreshment: true, isPeriode: true, kPeriode: 2023, kRefreshment: 2 });

      const user = await db.user.create({ data: { username: `${TAG}-nu`, nama: "Uji" } });
      uA = user;
      const pg = (nip: string, extra = {}) => db.pegawai.create({ data: { nip: `${TAG}-${nip}`, nama: `Pegawai ${nip}`, ...extra } });
      pgA = await pg("PA", { idUser: user.id });
      pgB = await pg("PB");
      pgC = await pg("PC");
      // A: jenjang Pertama 2020–2022, lalu Muda sejak 2023 (aktif)
      await db.pegawaiPenempatan.create({ data: { idPegawai: pgA.id, idInstansi: a.id, idJf: jfA.id, idJenjang: j1.id, tglMulai: d("2020-01-01"), tglSelesai: d("2022-12-31") } });
      await db.pegawaiPenempatan.create({ data: { idPegawai: pgA.id, idInstansi: a.id, idJf: jfA.id, idJenjang: j2.id, tglMulai: d("2023-01-01") } });
      await db.pegawaiPenempatan.create({ data: { idPegawai: pgB.id, idInstansi: b.id, idJf: jfB.id, idJenjang: j2.id, tglMulai: d("2023-01-01") } });
      await db.pegawaiPenempatan.create({ data: { idPegawai: pgC.id, idInstansi: a.id, idJf: jfA.id, tglMulai: d("2023-01-01") } }); // tanpa jenjang

      const batch = (idPelatihan: bigint, tgl: string, tahun: number) =>
        db.pelatihanBatch.create({ data: { idPelatihan, tahunPelaksanaan: tahun, tanggalMulai: d(tgl), tanggalSelesai: d(tgl) } });
      const b2 = await batch(pel2.id, "2021-06-01", 2021); // diikuti saat jenjang Pertama
      const b3 = await batch(pel3.id, "2023-06-01", 2023); // diikuti saat jenjang Muda
      const b1 = await batch(pel1.id, "2024-06-01", 2024);
      const peserta = (idBatch: bigint, statusKehadiran: string) =>
        db.pelatihanPesertaBatch.create({ data: { idBatch, idPegawai: pgA.id, statusKehadiran } });
      await peserta(b2.id, "hadir");
      await peserta(b3.id, "selesai");
      await peserta(b1.id, "terdaftar"); // belum hadir: tidak dihitung

      await db.pelatihanUsulan.create({ data: { idPegawai: pgA.id, idPelatihan: pel1.id, statusUsulan: "diajukan", diusulkanOleh: "t" } });
      await db.pelatihanUsulan.create({ data: { idPegawai: pgA.id, idPelatihan: pel2.id, statusUsulan: "ditolak", diusulkanOleh: "t" } });
      scopeA = { kind: "instansi", idInstansi: a.id };
    });

    const kolomIdx = (v: Extract<Awaited<ReturnType<typeof svc.lp.loadLearningPath>>, { state: "ok" }>, nama: string) =>
      v.kolom.findIndex((k) => k.nama === `${TAG}-${nama}`);
    const self = () => ({ idUser: uA.id, scope: { kind: "self", idUser: uA.id } as Scope, canPick: false });

    it("pegawai melihat dirinya: status per sel benar, riwayat memakai jenjang saat itu, usulan aktif jadi badge", async () => {
      const v = await svc.lp.loadLearningPath(self(), { tahun: 2026 });
      if (v.state !== "ok") throw new Error(`state ${v.state}`);
      const [c1, c2, c3] = [kolomIdx(v, "NJ1"), kolomIdx(v, "NJ2"), kolomIdx(v, "NJ3")];
      const row = (n: string) => v.rows.find((r) => r.nama === `${TAG}-${n}`)!;
      // NL1: berlaku di 1,2,3; belum diikuti (terdaftar saja)
      expect([row("NL1").cells[c1], row("NL1").cells[c2], row("NL1").cells[c3]]).toEqual(["terlewat", "wajib_sekarang", "akan_datang"]);
      // NL2: diikuti 2021 saat jenjang Pertama
      expect([row("NL2").cells[c1], row("NL2").cells[c2]]).toEqual(["selesai", "tidak_berlaku"]);
      // NL3: diikuti 2023 saat Muda, refreshment 2 tahun → 2023+2 <= 2026
      expect(row("NL3").cells[c2]).toBe("perlu_refresh");
      expect(row("NL1").usulan).toBe("diajukan");
      expect(row("NL2").usulan).toBeNull(); // ditolak tidak ditampilkan
      expect(v.kolom[c2]!.sekarang).toBe(true);
      // tahun acuan lebih awal → refresh belum jatuh tempo
      const v2 = await svc.lp.loadLearningPath(self(), { tahun: 2024 });
      if (v2.state !== "ok") throw new Error("state");
      expect(v2.rows.find((r) => r.nama === `${TAG}-NL3`)!.cells[kolomIdx(v2, "NJ2")]).toBe("selesai");
    });

    it("pegawai biasa tidak bisa membuka pegawai lain lewat token (404)", async () => {
      await expect(svc.lp.loadLearningPath(self(), { pegawai: tok(pgB.id) })).rejects.toMatchObject({ status: 404 });
    });

    it("admin instansi: boleh pegawai instansinya, pegawai instansi lain 404, pencarian hanya dalam scope", async () => {
      const admin = { idUser: -1n, scope: scopeA, canPick: true };
      const v = await svc.lp.loadLearningPath(admin, { pegawai: tok(pgA.id), tahun: 2026 });
      expect(v.state).toBe("ok");
      await expect(svc.lp.loadLearningPath(admin, { pegawai: tok(pgB.id) })).rejects.toMatchObject({ status: 404 });
      await expect(svc.lp.loadLearningPath(admin, { pegawai: "###" })).rejects.toMatchObject({ status: 404 });
      const hasil = await svc.lp.cariPegawai(admin, TAG);
      expect(hasil.map((h) => h.token).sort()).toEqual([tok(pgA.id), tok(pgC.id)].sort());
      expect(await svc.lp.cariPegawai({ ...admin, canPick: false }, TAG)).toEqual([]);
    });

    it("akun tanpa data pegawai, dan penempatan tanpa jenjang, ditangani tanpa error", async () => {
      expect((await svc.lp.loadLearningPath({ idUser: -99n, scope: { kind: "self", idUser: -99n }, canPick: false }, {})).state).toBe("tidak_ada_pegawai");
      const v = await svc.lp.loadLearningPath({ idUser: -1n, scope: { kind: "all" }, canPick: true }, { pegawai: tok(pgC.id) });
      expect(v.state).toBe("belum_penempatan");
    });

    it("pelatihan yang sudah punya batch/usulan tidak bisa dihapus (409 lewat run)", async () => {
      const { run } = await import("@/server/services/master/shared");
      const r = await run(() => svc.pelatihan.removePelatihan(ids().encode("pelatihan", pel1.id), "t", { kind: "all" }));
      expect(r).toMatchObject({ ok: false, code: "CONFLICT" });
      expect(await db.pelatihan.count({ where: { id: pel1.id } })).toBe(1);
    });
  });
});
