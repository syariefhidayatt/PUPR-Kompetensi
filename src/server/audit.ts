import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

type AuditOptions = {
  entitas?: string;
  entitasId?: string;
  actor?: string;
  actorRole?: string;
  ip?: string;
  meta?: Prisma.InputJsonValue;
};

/** Audit hanya untuk login/registrasi/mutasi. Kegagalan audit tidak boleh menggagalkan alur utama. */
export async function audit(aksi: string, opts: AuditOptions = {}) {
  try {
    await db.auditLog.create({ data: { aksi, ...opts } });
  } catch (err) {
    logger.error({ err, aksi }, "gagal menulis audit log");
  }
}
