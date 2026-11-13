"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { onboardingSchema } from "@/lib/schemas/onboarding";
import { audit } from "@/server/audit";
import { unstable_update } from "@/server/auth/auth";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ids } from "@/server/ids";
import { logger } from "@/server/logger";

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

export async function submitOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const sessionUser = await requireUser();
  const userId = BigInt(sessionUser.id);

  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Periksa kembali isian yang bertanda merah.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Token → id. Token rusak / bukan jenis yang benar → ditolak.
  const idInstansi = ids().decode("instansi", data.instansi);
  const idJf = ids().decode("jf", data.jf);
  const idJenjang = ids().decode("jenjang", data.jenjang);
  if (idInstansi === null || idJf === null || idJenjang === null) {
    return { error: "Pilihan tidak valid. Muat ulang halaman lalu coba lagi." };
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId }, include: { pegawai: { select: { id: true } } } });
    if (!user || !user.statusAktif) return { error: "Akun tidak dapat diproses." };
    if (user.pegawai) redirect("/"); // sudah pernah onboarding

    // Validasi server (jangan percaya client): instansi HARUS Daerah (jenis 2, D6),
    // JF berasal dari instansi pembina (jenis 1/3, Q3), jenjang aktif.
    const [instansi, jf, jenjang] = await Promise.all([
      db.instansi.findFirst({ where: { id: idInstansi, jenis: 2, statusAktif: true }, select: { id: true } }),
      db.jf.findFirst({
        where: { id: idJf, statusAktif: true, instansi: { jenis: { in: [1, 3] }, statusAktif: true } },
        select: { id: true },
      }),
      db.jenjangJabatan.findFirst({ where: { id: idJenjang, statusAktif: true }, select: { id: true } }),
    ]);
    if (!instansi || !jf || !jenjang) {
      return { error: "Instansi harus berupa instansi Pemerintah Daerah dan JF/jenjang harus aktif." };
    }

    await db.$transaction(async (tx) => {
      await tx.pegawai.create({
        data: {
          idUser: userId,
          nip: data.nip,
          nama: data.nama,
          email: user.email,
          hp: data.hp,
          telp: data.telp,
          tempatLahir: data.tempatLahir,
          tglLahir: data.tglLahir,
          jenisKelamin: data.jenisKelamin,
          agama: data.agama,
          alamat: data.alamat,
          pendidikan: data.pendidikan,
          jurusan: data.jurusan,
          golongan: data.golongan,
          tmt: data.tmt,
          createdBy: user.username,
          penempatan: {
            create: {
              idInstansi: instansi.id,
              idJf: jf.id,
              idJenjang: jenjang.id,
              statusPegawai: data.statusPegawai,
              tglMulai: data.tglMulai,
              noSk: data.noSk,
              keterangan: data.keterangan,
            },
          },
        },
      });
      // D7: username berganti dari placeholder "g-<sub>" menjadi NIP.
      await tx.user.update({
        where: { id: userId },
        data: { username: data.nip, idInstansi: instansi.id, nama: data.nama },
      });
    });

    await audit("onboarding_complete", {
      actor: data.nip,
      entitas: "User",
      entitasId: String(userId),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "NIP sudah terdaftar atau dipakai akun lain.", fieldErrors: { nip: ["NIP sudah terdaftar"] } };
    }
    // Next.js memakai exception khusus untuk redirect() — jangan ditelan.
    if (err instanceof Error && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    logger.error({ err }, "onboarding gagal");
    return { error: "Terjadi kesalahan saat menyimpan data. Silakan coba lagi." };
  }

  // Segarkan JWT (profileComplete, idInstansi, nama) lalu masuk ke aplikasi.
  await unstable_update({ user: { name: data.nama } });
  redirect("/");
}
