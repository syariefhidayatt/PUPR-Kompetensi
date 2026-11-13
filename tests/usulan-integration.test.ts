/**
 * Tes integrasi usulan (DB sungguhan). Dilewati bila TEST_DATABASE_URL tidak diset.
 * Memakai prefix "utest-" (terpisah dari "itest-") agar aman jalan paralel dengan master-integration.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "utest-";
const TAG = `${PREFIX}${Date.now()}`;

describe.skipIf(!url)("usulan (DB sungguhan)", () => {
  let db: typeof import("@/server/db").db;
  let ids: typeof import("@/server/ids").ids;
  let svc: typeof import("@/server/services/usulan");
  let apr: typeof import("@/server/services/usulan-approval");
  let bsvc: typeof import("@/server/services/batch");

  type Aktor = import("@/server/services/usulan").Aktor;
  let aInstansi: { id: bigint };
  let pegA: { id: bigint };
  let pegLain: { id: bigint };
  let pelOk: { id: bigint };
  let pelLain: { id: bigint };
  let pelPrasyarat: { id: bigint };
  let diriA: Aktor;
  let adminA: Aktor;
  let adminB: Aktor;
  let diriLain: Aktor;
  let jfAId: bigint;
  let j1Id: bigint;

  async function cleanup() {
    await db.pelatihanPesertaBatch.deleteMany({ where: { batch: { pelatihan: { namaPelatihan: { startsWith: PREFIX } } } } });
    await db.pelatihanBatch.deleteMany({ where: { pelatihan: { namaPelatihan: { startsWith: PREFIX } } } });
    await db.pelatihanUsulan.deleteMany({ where: { pelatihan: { namaPelatihan: { startsWith: PREFIX } } } });
    await db.pegawaiPenempatan.deleteMany({ where: { pegawai: { nip: { startsWith: PREFIX } } } });
    await db.pegawai.deleteMany({ where: { nip: { startsWith: PREFIX } } });
    await db.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
    await db.pelatihan.deleteMany({ where: { namaPelatihan: { startsWith: PREFIX } } });
    await db.programBangkom.deleteMany({ where: { namaProgram: { startsWith: PREFIX } } });
    await db.jf.deleteMany({ where: { namaJf: { startsWith: PREFIX } } });
    await db.instansi.deleteMany({ where: { nama: { startsWith: PREFIX } } });
    await db.jenisKompetensiDetail.deleteMany({ where: { jenis: { namaJenis: { startsWith: PREFIX } } } });
    await db.jenisKompetensi.deleteMany({ where: { namaJenis: { startsWith: PREFIX } } });
    await db.jenjangJabatan.deleteMany({ where: { nama: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url!;
    process.env.DIRECT_URL = url!;
    ({ db } = await import("@/server/db"));
    ({ ids } = await import("@/server/ids"));
    svc = await import("@/server/services/usulan");
    apr = await import("@/server/services/usulan-approval");
    bsvc = await import("@/server/services/batch");
    await cleanup();

    aInstansi = await db.instansi.create({ data: { nama: `${TAG}-A`, jenis: 2 } });
    const bInstansi = await db.instansi.create({ data: { nama: `${TAG}-B`, jenis: 2 } });
    const jfA = await db.jf.create({ data: { idInstansi: aInstansi.id, namaJf: `${TAG}-JFA` } });
    const jfB = await db.jf.create({ data: { idInstansi: bInstansi.id, namaJf: `${TAG}-JFB` } });
    const j1 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-J1`, urutan: 1 } });
    jfAId = jfA.id;
    j1Id = j1.id;
    const j2 = await db.jenjangJabatan.create({ data: { nama: `${TAG}-J2`, urutan: 2 } });
    const jenis = await db.jenisKompetensi.create({ data: { namaJenis: `${TAG}-JK`, details: { create: { namaDetail: "d" } } }, include: { details: true } });
    const det = jenis.details[0]!;
    const progA = await db.programBangkom.create({ data: { idJf: jfA.id, idJenisDetail: det.id, namaProgram: `${TAG}-PA` } });
    const progB = await db.programBangkom.create({ data: { idJf: jfB.id, idJenisDetail: det.id, namaProgram: `${TAG}-PB` } });
    pelOk = await db.pelatihan.create({ data: { idProgram: progA.id, namaPelatihan: `${TAG}-OK` } });
    pelLain = await db.pelatihan.create({ data: { idProgram: progB.id, namaPelatihan: `${TAG}-LAIN` } });
    pelPrasyarat = await db.pelatihan.create({ data: { idProgram: progA.id, namaPelatihan: `${TAG}-PRA`, jenjang: { create: { idJenjang: j2.id } } } });

    const uA = await db.user.create({ data: { username: `${TAG}-ua`, nama: "A" } });
    const uLain = await db.user.create({ data: { username: `${TAG}-ulain`, nama: "L" } });
    pegA = await db.pegawai.create({ data: { nip: `${TAG}-1`, nama: "Pegawai A", idUser: uA.id } });
    pegLain = await db.pegawai.create({ data: { nip: `${TAG}-2`, nama: "Pegawai Lain", idUser: uLain.id } });
    const tgl = new Date("2020-01-01T00:00:00Z");
    await db.pegawaiPenempatan.create({ data: { idPegawai: pegA.id, idInstansi: aInstansi.id, idJf: jfA.id, idJenjang: j1.id, tglMulai: tgl } });
    await db.pegawaiPenempatan.create({ data: { idPegawai: pegLain.id, idInstansi: bInstansi.id, idJf: jfB.id, idJenjang: j1.id, tglMulai: tgl } });

    diriA = { username: `${TAG}-ua`, idUser: uA.id, roles: ["pegawai"], scope: { kind: "self", idUser: uA.id } };
    diriLain = { username: `${TAG}-ulain`, idUser: uLain.id, roles: ["pegawai"], scope: { kind: "self", idUser: uLain.id } };
    adminA = { username: `${TAG}-adm`, idUser: 0n, roles: ["admin_instansi"], scope: { kind: "instansi", idInstansi: aInstansi.id } };
    adminB = { username: `${TAG}-admb`, idUser: 0n, roles: ["admin_instansi"], scope: { kind: "instansi", idInstansi: bInstansi.id } };
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await cleanup();
    } finally {
      await db.$disconnect();
    }
  });

  const tok = (k: "pelatihan" | "pegawai", id: bigint) => ids().encode(k, id);
  let tokenUsulan = "";

  it("pegawai mengusulkan untuk dirinya → status mengusulkan", async () => {
    const r = await svc.createUsulan({ pelatihan: tok("pelatihan", pelOk.id), alasan: "perlu" }, diriA);
    tokenUsulan = r.token;
    const row = await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: pegA.id, idPelatihan: pelOk.id } });
    expect(row.statusUsulan).toBe("mengusulkan");
    expect(row.diusulkanOlehRole).toBe("pegawai");
  });

  it("usulan ganda aktif → 409", async () => {
    await expect(svc.createUsulan({ pelatihan: tok("pelatihan", pelOk.id) }, diriA)).rejects.toMatchObject({ status: 409 });
  });

  it("pelatihan JF lain → 422; prasyarat jenjang tidak terpenuhi → 422", async () => {
    await expect(svc.createUsulan({ pelatihan: tok("pelatihan", pelLain.id) }, diriA)).rejects.toMatchObject({ status: 422 });
    await expect(svc.createUsulan({ pelatihan: tok("pelatihan", pelPrasyarat.id) }, diriA)).rejects.toMatchObject({ status: 422 });
  });

  it("pegawai tidak bisa mengusulkan untuk orang lain (token pegawai diabaikan)", async () => {
    await expect(
      svc.createUsulan({ pelatihan: tok("pelatihan", pelLain.id), pegawai: tok("pegawai", pegLain.id) }, diriA),
    ).rejects.toMatchObject({ status: 422 }); // tetap dihitung untuk dirinya: pelatihan JF lain
    expect(await db.pelatihanUsulan.count({ where: { idPegawai: pegLain.id } })).toBe(0);
  });

  it("admin instansi lain: pegawai di luar scope → 422, daftar kosong, batal → 404", async () => {
    await expect(svc.createUsulan({ pelatihan: tok("pelatihan", pelOk.id), pegawai: tok("pegawai", pegA.id) }, adminB)).rejects.toMatchObject({ status: 422 });
    expect((await svc.listUsulan(adminB, { page: 1 })).rows.filter((r) => r.nip === `${TAG}-1`)).toHaveLength(0);
    await expect(svc.batalkanUsulan(tokenUsulan, adminB)).rejects.toMatchObject({ status: 404 });
    await expect(svc.batalkanUsulan(tokenUsulan, diriLain)).rejects.toMatchObject({ status: 404 });
  });

  it("admin instansi sendiri: daftar terlihat; form hanya menampilkan yang layak", async () => {
    expect((await svc.listUsulan(adminA, { page: 1 })).rows.some((r) => r.nip === `${TAG}-1`)).toBe(true);
    const f = await svc.loadFormUsulan(adminA, tok("pegawai", pegA.id));
    expect(f.state).toBe("ok");
    if (f.state === "ok") {
      expect(f.pilihan.map((p) => p.label)).not.toContain(`${TAG}-OK`); // sudah diusulkan
      expect(f.pilihan.map((p) => p.label)).not.toContain(`${TAG}-PRA`); // prasyarat
      expect(f.pilihan.map((p) => p.label)).not.toContain(`${TAG}-LAIN`); // JF lain
    }
  });

  it("batalkan oleh pemilik → dibatalkan; boleh mengusulkan lagi; admin atas nama → diajukan", async () => {
    await svc.batalkanUsulan(tokenUsulan, diriA);
    await expect(svc.batalkanUsulan(tokenUsulan, diriA)).rejects.toMatchObject({ status: 409 });
    await svc.createUsulan({ pelatihan: tok("pelatihan", pelOk.id), pegawai: tok("pegawai", pegA.id) }, adminA);
    const hidup = await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: pegA.id, statusUsulan: "diajukan" } });
    expect(hidup.diusulkanOlehRole).toBe("admin_instansi");
  });

  it("usulan disetujui tidak bisa dibatalkan (409)", async () => {
    const row = await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: pegA.id, statusUsulan: "diajukan" } });
    await db.pelatihanUsulan.update({ where: { id: row.id }, data: { statusUsulan: "disetujui" } });
    await expect(svc.batalkanUsulan(ids().encode("usulan", row.id), adminA)).rejects.toMatchObject({ status: 409 });
  });

  // ---------- Fase 7c: persetujuan, peserta batch, kapasitas ----------
  async function pegawaiBaru(n: string) {
    const p = await db.pegawai.create({ data: { nip: `${TAG}-${n}`, nama: `Pegawai ${n}` } });
    await db.pegawaiPenempatan.create({ data: { idPegawai: p.id, idInstansi: aInstansi.id, idJf: jfAId, idJenjang: j1Id, tglMulai: new Date("2020-01-01T00:00:00Z") } });
    return p;
  }
  const usulkan = async (idPeg: bigint, idPel: bigint = pelOk.id) =>
    (await svc.createUsulan({ pelatihan: tok("pelatihan", idPel), pegawai: tok("pegawai", idPeg) }, adminA)).token;
  const batchBaru = (kapasitas: number, statusBatch = "terjadwal", idPel: bigint = pelOk.id, angkatan = String(Math.random()).slice(2, 8)) =>
    db.pelatihanBatch.create({ data: { idPelatihan: idPel, tahunPelaksanaan: 2030, angkatan, tanggalMulai: new Date("2030-01-01T00:00:00Z"), tanggalSelesai: new Date("2030-01-02T00:00:00Z"), kapasitas, statusBatch } });
  const tokB = (id: bigint) => ids().encode("batch", id);

  it("setujui + batch → peserta terdaftar; kapasitas 1 penuh → 409 dan usulan tetap belum diputuskan", async () => {
    const c = await pegawaiBaru("c");
    const d = await pegawaiBaru("d");
    const b = await batchBaru(1);
    const uC = await usulkan(c.id);
    const uD = await usulkan(d.id);
    await apr.setujuiUsulan(uC, tokB(b.id), adminA);
    expect((await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: c.id, idPelatihan: pelOk.id } })).statusUsulan).toBe("disetujui");
    expect(await db.pelatihanPesertaBatch.count({ where: { idBatch: b.id, idPegawai: c.id } })).toBe(1);

    await expect(apr.setujuiUsulan(uD, tokB(b.id), adminA)).rejects.toMatchObject({ status: 409 });
    expect((await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: d.id, idPelatihan: pelOk.id } })).statusUsulan).toBe("diajukan"); // rollback

    // mengeluarkan peserta membebaskan kursi
    const peserta = await db.pelatihanPesertaBatch.findFirstOrThrow({ where: { idBatch: b.id, idPegawai: c.id } });
    await bsvc.keluarkanPeserta(ids().encode("peserta", peserta.id), "t", adminA.scope);
    await apr.setujuiUsulan(uD, tokB(b.id), adminA);
    expect(await db.pelatihanPesertaBatch.count({ where: { idBatch: b.id } })).toBe(1);
  });

  it("dua persetujuan bersamaan untuk batch berkapasitas 1 → tepat satu yang lolos", async () => {
    const e = await pegawaiBaru("e");
    const f = await pegawaiBaru("f");
    const b = await batchBaru(1);
    const [uE, uF] = [await usulkan(e.id), await usulkan(f.id)];
    const hasil = await Promise.allSettled([apr.setujuiUsulan(uE, tokB(b.id), adminA), apr.setujuiUsulan(uF, tokB(b.id), adminA)]);
    expect(hasil.filter((h) => h.status === "fulfilled")).toHaveLength(1);
    expect(await db.pelatihanPesertaBatch.count({ where: { idBatch: b.id } })).toBe(1);
  });

  it("batch tidak valid: pelatihan lain, status selesai, kapasitas 0 = tanpa batas", async () => {
    const g = await pegawaiBaru("g");
    const u = await usulkan(g.id);
    await expect(apr.setujuiUsulan(u, tokB((await batchBaru(5, "selesai")).id), adminA)).rejects.toMatchObject({ status: 422 });
    await expect(apr.setujuiUsulan(u, tokB((await batchBaru(5, "terjadwal", pelPrasyarat.id)).id), adminA)).rejects.toMatchObject({ status: 422 });
    await apr.setujuiUsulan(u, tokB((await batchBaru(0)).id), adminA); // tanpa batas
    expect((await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: g.id, idPelatihan: pelOk.id } })).statusUsulan).toBe("disetujui");
  });

  it("admin instansi lain tidak bisa menyetujui/menolak/mendaftarkan (404)", async () => {
    const h = await pegawaiBaru("h");
    const u = await usulkan(h.id);
    await expect(apr.setujuiUsulan(u, undefined, adminB)).rejects.toMatchObject({ status: 404 });
    await expect(apr.tolakUsulan(u, "tidak sesuai", adminB)).rejects.toMatchObject({ status: 404 });
    await expect(apr.daftarkanKeBatch(u, tokB((await batchBaru(5)).id), adminB)).rejects.toMatchObject({ status: 404 });
  });

  it("tolak: simpan alasan, tidak bisa diputuskan dua kali, boleh diusulkan lagi; daftar batch hanya untuk yang disetujui", async () => {
    const i = await pegawaiBaru("i");
    const u = await usulkan(i.id);
    const b = await batchBaru(5);
    await expect(apr.daftarkanKeBatch(u, tokB(b.id), adminA)).rejects.toMatchObject({ status: 409 }); // belum disetujui
    await apr.tolakUsulan(u, "Kuota unit habis", adminA);
    const row = await db.pelatihanUsulan.findFirstOrThrow({ where: { idPegawai: i.id, idPelatihan: pelOk.id } });
    expect(row.statusUsulan).toBe("ditolak");
    expect(row.alasanPenolakan).toBe("Kuota unit habis");
    await expect(apr.setujuiUsulan(u, undefined, adminA)).rejects.toMatchObject({ status: 409 });
    await usulkan(i.id); // setelah ditolak boleh mengusulkan lagi
  });

  it("setujui tanpa batch lalu daftarkan belakangan; ganda → 409; peserta hadir tidak bisa dikeluarkan", async () => {
    const j = await pegawaiBaru("j");
    const u = await usulkan(j.id);
    await apr.setujuiUsulan(u, undefined, adminA);
    const b = await batchBaru(5);
    await apr.daftarkanKeBatch(u, tokB(b.id), adminA);
    await expect(apr.daftarkanKeBatch(u, tokB(b.id), adminA)).rejects.toMatchObject({ status: 409 });
    const p = await db.pelatihanPesertaBatch.findFirstOrThrow({ where: { idBatch: b.id, idPegawai: j.id } });
    await bsvc.setKehadiran(ids().encode("peserta", p.id), "hadir", "t", adminA.scope);
    await expect(bsvc.keluarkanPeserta(ids().encode("peserta", p.id), "t", adminA.scope)).rejects.toMatchObject({ status: 409 });
    await expect(bsvc.keluarkanPeserta(ids().encode("peserta", p.id), "t", adminB.scope)).rejects.toMatchObject({ status: 404 });
  });

  it("batch: ubah kapasitas (0 = tanpa batas) boleh; hapus batch berisi peserta → 409", async () => {
    const k = await pegawaiBaru("k");
    const u = await usulkan(k.id);
    const b = await batchBaru(5);
    await apr.setujuiUsulan(u, tokB(b.id), adminA);
    const input = {
      pelatihan: tok("pelatihan", pelOk.id), penyelenggara: undefined, tahunPelaksanaan: 2030, angkatan: b.angkatan,
      tanggalMulai: "2030-01-01", tanggalSelesai: "2030-01-02", kapasitas: 0, statusBatch: "terjadwal", keterangan: undefined, statusAktif: true,
    } as import("@/lib/schemas/batch").BatchInput;
    await bsvc.updateBatch(tokB(b.id), input, "t", adminA.scope); // 0 = tanpa batas: boleh
    await expect(bsvc.updateBatch(tokB(b.id), { ...input, kapasitas: 1 }, "t", adminA.scope)).resolves.toBeUndefined(); // 1 peserta, kapasitas 1: boleh
    await expect(bsvc.removeBatch(tokB(b.id), "t", adminA.scope)).rejects.toMatchObject({ status: 409 });
  });
});
