import type { Prisma } from "@prisma/client";
import type { Scope } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { decodeOr404 } from "./shared";

/** Baris yang dimiliki lewat JF (Kompetensi, Program): lingkup = instansi pemilik JF. */
export function viaJfScope(scope: Scope): { jf: Prisma.JfWhereInput } | { id: bigint } | Record<string, never> {
  if (scope.kind === "all") return {};
  if (scope.kind === "instansi") return { jf: { idInstansi: scope.idInstansi } };
  return { id: -1n };
}

/** JF harus ada DAN berada dalam scope aktor; selain itu ditolak (tidak membocorkan JF instansi lain). */
export async function resolveJf(token: string, scope: Scope) {
  const idJf = decodeOr404("jf", token);
  const jf = await db.jf.findUnique({ where: { id: idJf }, select: { id: true, idInstansi: true } });
  const allowed = jf && (scope.kind === "all" || (scope.kind === "instansi" && jf.idInstansi === scope.idInstansi));
  if (!allowed) throw new AppError("INVALID", 422, "JF tidak valid.", { jf: ["JF tidak valid"] });
  return idJf;
}

export async function resolveDetail(token: string) {
  const idJenisDetail = decodeOr404("jenisDetail", token);
  const d = await db.jenisKompetensiDetail.findUnique({ where: { id: idJenisDetail }, select: { id: true } });
  if (!d) throw new AppError("INVALID", 422, "Sub jenis tidak valid.", { jenisDetail: ["Sub jenis tidak valid"] });
  return idJenisDetail;
}
