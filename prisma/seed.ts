import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const RESOURCES = [
  "instansi", "jf", "jenjang", "sertifikasi",
  "jenis_kompetensi", "kompetensi", "program_bangkom", "pelatihan", "pegawai", "usulan", "penyelenggara", "batch",
  "unit_organisasi", "unit_kerja", "golongan", "pendidikan", "status_pegawai",
] as const;
const ACTIONS = ["view", "create", "update", "delete"] as const;
// Fase 10 (Pengelolaan): kebutuhan/rekap hanya dilihat; kehadiran.verify = mengubah status kehadiran peserta secara massal.
const EXTRA_PERMISSIONS = ["usulan.approve", "kebutuhan.view", "kehadiran.view", "kehadiran.verify", "rekap.view"];
const ALL_PERMISSIONS = [...RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}.${a}`)), ...EXTRA_PERMISSIONS];

const ROLES = [
  { kode: "admin_pusat", nama: "Admin Pusat" },
  { kode: "admin_instansi", nama: "Admin Instansi" },
  { kode: "pembina", nama: "Pembina" },
  { kode: "pegawai", nama: "Pegawai" },
];

// Matriks default (dokumen teknis §6.3). admin_pusat = semua permission yang ada.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin_instansi: [
    "pelatihan.view", "pelatihan.update",
    // Data CI4: pelatihan dibuat admin instansi untuk program instansinya; dibatasi scope di service.
    "pelatihan.create", "pelatihan.delete",
    "pegawai.view", "pegawai.create", "pegawai.update",
    "program_bangkom.view", "kompetensi.view", "jenis_kompetensi.view",
    // Data CI4: kompetensi/program/pelatihan dibuat oleh admin instansi untuk JF instansinya sendiri.
    // Dibatasi scope instansi di service (bukan di sini).
    "kompetensi.create", "kompetensi.update", "kompetensi.delete",
    "program_bangkom.create", "program_bangkom.update", "program_bangkom.delete",
    "instansi.view", "jf.view", "jenjang.view", "sertifikasi.view",
    // Fase 7b: usulan atas nama pegawai instansinya (scope di service). update = batalkan.
    "usulan.view", "usulan.create", "usulan.update", "usulan.approve",
    // Fase 7c: batch dibatasi scope instansi di service; penyelenggara master global (admin instansi hanya melihat).
    "batch.view", "batch.create", "batch.update", "batch.delete", "penyelenggara.view",
    // Fase 8: unit organisasi/kerja dibatasi scope instansi di service.
    "unit_organisasi.view", "unit_organisasi.create", "unit_organisasi.update", "unit_organisasi.delete",
    "unit_kerja.view", "unit_kerja.create", "unit_kerja.update", "unit_kerja.delete",
    "golongan.view", "pendidikan.view", "status_pegawai.view",
    // Fase 10: pengelolaan pelatihan, dibatasi scope instansi di service.
    "kebutuhan.view", "kehadiran.view", "kehadiran.verify", "rekap.view",
  ],
  pembina: [
    "pelatihan.view", "program_bangkom.view", "kompetensi.view",
    "instansi.view", "jf.view", "jenjang.view", "sertifikasi.view",
    "usulan.view", "batch.view", "unit_organisasi.view", "unit_kerja.view", "golongan.view", "pendidikan.view", "status_pegawai.view",
    "kebutuhan.view", "kehadiran.view", "rekap.view",
  ],
  // Pegawai hanya bisa mengusulkan/membatalkan usulan dirinya sendiri (scope "self" di service).
  pegawai: ["usulan.view", "usulan.create", "usulan.update"],
};

// Sesuai data DB CI4: dua rumpun dengan urutan kembar 1..4 (urutan hanya dibandingkan dalam rumpun yang sama).
const JENJANG: [string, "KEAHLIAN" | "KETERAMPILAN", number][] = [
  ["Pertama", "KEAHLIAN", 1], ["Muda", "KEAHLIAN", 2], ["Madya", "KEAHLIAN", 3], ["Utama", "KEAHLIAN", 4],
  ["Pemula", "KETERAMPILAN", 1], ["Terampil", "KETERAMPILAN", 2], ["Mahir", "KETERAMPILAN", 3], ["Penyelia", "KETERAMPILAN", 4],
];

// Izin yang sengaja dicabut dari role (seed bersifat aditif, jadi pencabutan harus eksplisit).
// pembina: `pelatihan.update` dicabut — mengubah data pelatihan bukan tugas pembina; jalur usulan memakai izin sendiri (Fase 7).
const REVOKED: Record<string, string[]> = { pembina: ["pelatihan.update"] };

async function seedRbac() {
  for (const kode of ALL_PERMISSIONS) {
    await db.permission.upsert({ where: { kode }, update: {}, create: { kode } });
  }
  for (const r of ROLES) {
    await db.role.upsert({ where: { kode: r.kode }, update: { nama: r.nama }, create: r });
  }
  const perms = await db.permission.findMany();
  const roles = await db.role.findMany();
  for (const role of roles) {
    const wanted = role.kode === "admin_pusat" ? perms : perms.filter((p) => ROLE_PERMISSIONS[role.kode]?.includes(p.kode));
    if (wanted.length === 0) continue;
    await db.rolePermission.createMany({
      data: wanted.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  for (const [kodeRole, kodes] of Object.entries(REVOKED)) {
    const role = roles.find((r) => r.kode === kodeRole);
    if (!role) continue;
    const del = await db.rolePermission.deleteMany({ where: { roleId: role.id, permission: { kode: { in: kodes } } } });
    if (del.count > 0) console.log(`RBAC: cabut ${kodes.join(", ")} dari ${kodeRole}`);
  }
  console.log(`RBAC: ${ROLES.length} role, ${ALL_PERMISSIONS.length} permission`);
}

async function seedJenjang() {
  for (const [nama, rumpun, urutan] of JENJANG) {
    const exists = await db.jenjangJabatan.findFirst({ where: { nama } });
    if (exists) await db.jenjangJabatan.update({ where: { id: exists.id }, data: { rumpun, urutan } });
    else await db.jenjangJabatan.create({ data: { nama, rumpun, urutan } });
  }
  console.log(`Jenjang: ${JENJANG.length}`);
}

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn("Admin: dilewati (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD kosong)");
    return;
  }
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD minimal 12 karakter");

  const role = await db.role.findUniqueOrThrow({ where: { kode: "admin_pusat" } });
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || null;
  const passwordHash = await hash(password);

  const user = await db.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, nama: "Administrator", email, passwordHash, authProvider: "LOCAL" },
  });
  await db.userRole.createMany({ data: [{ userId: user.id, roleId: role.id }], skipDuplicates: true });
  console.log(`Admin: ${username} (admin_pusat)`);
}

// HANYA dev: supaya onboarding bisa dicoba tanpa master instansi. Jangan aktifkan di produksi.
async function seedSample() {
  if (process.env.SEED_SAMPLE_DATA !== "true") return;
  let pusat = await db.instansi.findFirst({ where: { nama: "Kementerian Pembina (Contoh)" } });
  pusat ??= await db.instansi.create({ data: { nama: "Kementerian Pembina (Contoh)", jenis: 1 } });
  const pemda = await db.instansi.findFirst({ where: { nama: "Pemerintah Kota Contoh" } });
  if (!pemda) await db.instansi.create({ data: { nama: "Pemerintah Kota Contoh", jenis: 2 } });
  const jf = await db.jf.findFirst({ where: { namaJf: "JF Contoh", idInstansi: pusat.id } });
  if (!jf) await db.jf.create({ data: { namaJf: "JF Contoh", kodeJf: "CTH", idInstansi: pusat.id } });
  console.log("Sample: instansi Pusat, Pemda, dan JF contoh");
}

async function main() {
  await seedRbac();
  await seedJenjang();
  await seedAdmin();
  await seedSample();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
