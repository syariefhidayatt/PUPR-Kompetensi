import { timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

/**
 * Pelatihan refreshment: bila `kPeriode + kRefreshment <= tahun` maka periode dibuka lagi
 * (kPeriode = tahun, statusAktif = true). Sesudahnya kPeriode + kRefreshment > tahun (interval ≥ 1),
 * jadi menjalankannya berulang pada tahun yang sama tidak mengubah apa pun (idempoten).
 */
export function needsRefresh(p: { isRefreshment: boolean; kPeriode: number | null; kRefreshment: number | null }, tahun: number) {
  return p.isRefreshment && p.kPeriode !== null && p.kRefreshment !== null && p.kPeriode + p.kRefreshment <= tahun;
}

/** Tahun kalender di zona WIB (cron jalan 17:00 UTC = 00:00 WIB; tanpa ini tahun baru terlambat satu hari). */
export function tahunWib(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now));
}

/** Satu UPDATE atomik; mengembalikan id yang berubah. */
export async function refreshPelatihan(tahun: number = tahunWib(), actor = "cron") {
  const rows = await db.$queryRaw<{ id: bigint }[]>`
    UPDATE "Pelatihan"
       SET "kPeriode" = ${tahun}::smallint, "statusAktif" = true, "updatedAt" = now(), "updatedBy" = ${actor}
     WHERE "isRefreshment" = true
       AND "deletedAt" IS NULL
       AND "kPeriode" IS NOT NULL
       AND "kRefreshment" IS NOT NULL
       AND "kPeriode" + "kRefreshment" <= ${tahun}
    RETURNING id`;
  const ids = rows.map((r) => String(r.id));
  if (ids.length > 0) await audit("refresh", { entitas: "Pelatihan", actor, meta: { tahun, jumlah: ids.length, ids } });
  return { tahun, jumlah: ids.length, ids };
}

/** Bandingkan header `Authorization: Bearer <secret>` secara timing-safe. Tanpa secret terkonfigurasi → selalu ditolak. */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
