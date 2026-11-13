import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "@/server/errors";
import { ids, type IdKind } from "@/server/ids";
import { logger } from "@/server/logger";

export const PAGE_SIZE = 10;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[] | undefined> };

export function pageParams(sp: { q?: string; page?: string }) {
  const page = Math.min(100_000, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const q = sp.q?.trim().slice(0, 100) || undefined;
  return { page, q };
}

export const skip = (page: number) => (page - 1) * PAGE_SIZE;

/** Token rusak / bukan jenis yang diminta diperlakukan sama seperti data tidak ada. */
export function decodeOr404(kind: IdKind, token: unknown): bigint {
  const id = ids().decode(kind, token);
  if (id === null) throw new AppError("NOT_FOUND", 404, "Data tidak ditemukan.");
  return id;
}

export function parseForm<S extends z.ZodTypeAny>(schema: S, fd: FormData): z.output<S> {
  const r = schema.safeParse(Object.fromEntries(fd));
  if (!r.success) {
    throw new AppError("INVALID", 422, "Periksa kembali isian Anda.", r.error.flatten().fieldErrors);
  }
  return r.data;
}

/** Tolak (409) bila masih ada pemakai. `usage` = pasangan [nama pemakai, jumlah]. */
export function conflictIfUsed(label: string, usage: [string, number][]) {
  const used = usage.filter(([, n]) => n > 0);
  if (used.length === 0) return;
  const detail = used.map(([k, n]) => `${n} ${k}`).join(", ");
  throw new AppError("CONFLICT", 409, `${label} tidak dapat dihapus/dibuang karena masih dipakai: ${detail}.`);
}

function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest);
}

/**
 * Membungkus aksi mutasi: error aplikasi → hasil terstruktur; error DB/tak terduga → pesan generik
 * (detail hanya ke log, tidak pernah ke client — perbaikan M2/LP6).
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (isNextControlFlow(e)) throw e; // redirect()/notFound() harus lanjut
    if (e instanceof AppError) {
      return { ok: false, code: e.code, message: e.message, fieldErrors: e.fieldErrors };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, code: "CONFLICT", message: "Data dengan nilai yang sama sudah ada." };
      if (e.code === "P2003") {
        return { ok: false, code: "CONFLICT", message: "Data masih dipakai oleh data lain sehingga tidak dapat diubah/dihapus." };
      }
      if (e.code === "P2025") return { ok: false, code: "NOT_FOUND", message: "Data tidak ditemukan." };
    }
    // Pelanggaran ON DELETE RESTRICT (Postgres 23001) dilaporkan Prisma sebagai error tak dikenal, bukan P2003.
    if (e instanceof Prisma.PrismaClientUnknownRequestError && /23001|violates RESTRICT/i.test(e.message)) {
      return { ok: false, code: "CONFLICT", message: "Data masih dipakai oleh data lain sehingga tidak dapat diubah/dihapus." };
    }
    logger.error({ err: e }, "aksi master gagal");
    return { ok: false, code: "INTERNAL", message: "Terjadi kesalahan. Silakan coba lagi." };
  }
}
