import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/guards";
import { scopeFor, type Scope } from "@/server/auth/rbac";
import { run, type ActionResult } from "./shared";

/**
 * Pola tunggal untuk semua server action mutasi: cek permission → jalankan → refresh halaman.
 * Hanya dipakai dari file "use server" (tidak diimpor oleh tes service).
 */
export async function mutate<T>(
  permission: string,
  path: string,
  fn: (actor: string, scope: Scope) => Promise<T>,
): Promise<ActionResult<T>> {
  return run(async () => {
    const { user } = await requirePermission(permission);
    const out = await fn(user.username, scopeFor(user));
    revalidatePath(path);
    return out;
  });
}
