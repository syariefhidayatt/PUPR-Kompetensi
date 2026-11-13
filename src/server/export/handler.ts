import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth/auth";
import { hasPermission, scopeFor, type Scope } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { rateLimit } from "@/server/ratelimit";
import { exportResponse, isFormat, type TableData } from "./table-export";
import { Session } from "next-auth";

const plain = (status: number, text: string) =>
  new Response(text, { status, headers: { "Cache-Control": "no-store" } });

type SessionUser = NonNullable<Session["user"]>;

/**
 * Pola tunggal route ekspor: login → permission (tanpa izin = 404) → batas laju → bangun tabel → kirim berkas.
 * `build` melempar AppError 404 untuk data di luar scope; hasilnya `null` = tidak ada data (404).
 */
export async function handleExport(
  req: NextRequest,
  opts: {
    key: string;
    permission: string;
    build: (ctx: {
      scope: Scope;
      user: NonNullable<SessionUser>;
      sp: URLSearchParams;
    }) => Promise<{ table: TableData; base: string } | null>;
  },
): Promise<Response> {
  const user = (await auth())?.user;
  if (!user?.id) return plain(401, "Unauthorized");
  if (!hasPermission(user, opts.permission)) return plain(404, "Not found");
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  if (!isFormat(format)) return plain(400, "Format tidak didukung (xlsx atau pdf).");
  if (!(await rateLimit(`export:${opts.key}:${user.id}`, 10, 60)))
    return plain(429, "Terlalu banyak permintaan. Coba lagi sebentar.");
  try {
    const out = await opts.build({ scope: scopeFor(user), user, sp: req.nextUrl.searchParams });
    if (!out) return plain(404, "Not found");
    await audit(`export.${opts.key}`, {
      entitas: opts.key,
      actor: user.username,
      meta: { format, baris: out.table.rows.length },
    });
    return await exportResponse(format, out.table, out.base, user.username);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) return plain(404, "Not found");
    logger.error({ err: e }, `ekspor ${opts.key} gagal`);
    return plain(500, "Gagal membuat berkas.");
  }
}
