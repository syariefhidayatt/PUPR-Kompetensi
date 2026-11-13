import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";

/** Untuk page/server action: tidak login → redirect ke /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/** Untuk server action/handler: tanpa permission → AppError 403 (dipetakan jadi hasil generik oleh run()). */
export async function requirePermission(kode: string) {
  const user = await requireUser();
  if (!hasPermission(user, kode)) throw new AppError("FORBIDDEN", 403, "Anda tidak memiliki akses.");
  return { user, scope: scopeFor(user) };
}

/** Untuk page: tanpa permission → 404 (tidak membocorkan keberadaan halaman). */
export async function requirePageAccess(kode: string) {
  const user = await requireUser();
  if (!hasPermission(user, kode)) notFound();
  return user;
}
