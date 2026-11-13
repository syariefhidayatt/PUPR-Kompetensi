import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/auth/actions";
import { db } from "@/server/db";
import { ids } from "@/server/ids";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Lengkapi Profil" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profileComplete) redirect("/");

  // Opsi dibaca langsung di server (tanpa endpoint terbuka) dan dibatasi sesuai D6/Q3.
  const [instansi, jf, jenjang, me] = await Promise.all([
    db.instansi.findMany({
      where: { jenis: 2, statusAktif: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    db.jf.findMany({
      where: { statusAktif: true, instansi: { jenis: { in: [1, 3] }, statusAktif: true } },
      orderBy: { namaJf: "asc" },
      select: { id: true, namaJf: true, instansi: { select: { nama: true } } },
    }),
    db.jenjangJabatan.findMany({
      where: { statusAktif: true },
      orderBy: { urutan: "asc" },
      select: { id: true, nama: true },
    }),
    db.user.findUnique({ where: { id: BigInt(user.id) }, select: { nama: true, email: true } }),
  ]);

  const t = ids();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lengkapi profil Anda</h1>
          <p className="mt-1 text-sm text-muted">
            Data ini wajib diisi sebelum Anda dapat memakai fitur lain.
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-muted underline">
            Keluar
          </button>
        </form>
      </header>

      {instansi.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm">
          Belum ada instansi Pemerintah Daerah yang terdaftar. Hubungi administrator.
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <OnboardingForm
          defaultNama={me?.nama ?? ""}
          email={me?.email ?? ""}
          instansi={instansi.map((i) => ({ token: t.encode("instansi", i.id), label: i.nama }))}
          jf={jf.map((j) => ({ token: t.encode("jf", j.id), label: `${j.namaJf} — ${j.instansi.nama}` }))}
          jenjang={jenjang.map((j) => ({ token: t.encode("jenjang", j.id), label: j.nama }))}
        />
      </div>
    </div>
  );
}
