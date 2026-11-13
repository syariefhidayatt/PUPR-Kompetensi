// Fungsi murni (tanpa import next/prisma) agar mudah diuji.

export type Scope =
  | { kind: "all" }
  | { kind: "instansi"; idInstansi: bigint }
  | { kind: "self"; idUser: bigint };

type UserLike = { id: string; roles: string[]; permissions: string[]; idInstansi: string | null };

export function hasPermission(user: Pick<UserLike, "permissions">, kode: string): boolean {
  return user.permissions.includes(kode);
}

/**
 * Lingkup data yang boleh dilihat user. Semua query daftar pegawai/JF/pelatihan wajib melewatinya.
 * Fail-safe: admin_instansi/pembina tanpa instansi jatuh ke "self", bukan "all".
 */
export function scopeFor(user: Pick<UserLike, "id" | "roles" | "idInstansi">): Scope {
  if (user.roles.includes("admin_pusat")) return { kind: "all" };
  if ((user.roles.includes("admin_instansi") || user.roles.includes("pembina")) && user.idInstansi) {
    return { kind: "instansi", idInstansi: BigInt(user.idInstansi) };
  }
  return { kind: "self", idUser: BigInt(user.id) };
}
