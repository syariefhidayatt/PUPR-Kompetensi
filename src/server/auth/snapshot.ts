import { db } from "@/server/db";

export type AuthSnapshot = {
  uid: string;
  username: string;
  name: string;
  roles: string[];
  permissions: string[];
  idInstansi: string | null;
  authProvider: "LOCAL" | "GOOGLE";
  profileComplete: boolean;
};

/** Memuat identitas + role + permission dari DB. Dipanggil saat login dan saat session.update(). */
export async function loadSnapshot(userId: bigint): Promise<AuthSnapshot | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      pegawai: { select: { id: true } },
    },
  });
  if (!u || !u.statusAktif) return null;

  const permissions = new Set<string>();
  for (const ur of u.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.kode);

  return {
    uid: String(u.id),
    username: u.username,
    name: u.nama,
    roles: u.roles.map((r) => r.role.kode),
    permissions: [...permissions],
    idInstansi: u.idInstansi === null ? null : String(u.idInstansi),
    authProvider: u.authProvider,
    // Gate onboarding hanya berlaku untuk akun Google (D5): akun lokal dibuat admin → dianggap lengkap.
    profileComplete: u.authProvider === "LOCAL" || u.pegawai !== null,
  };
}
