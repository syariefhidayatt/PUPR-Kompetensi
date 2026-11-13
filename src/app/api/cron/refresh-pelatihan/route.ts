import { NextResponse } from "next/server";
import { env } from "@/env";
import { logger } from "@/server/logger";
import { isCronAuthorized, refreshPelatihan } from "@/server/services/pelatihan-refresh";

export const dynamic = "force-dynamic";

// Dipanggil Vercel Cron (vercel.json). Vercel otomatis mengirim `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    logger.error("CRON_SECRET belum diset; endpoint cron dinonaktifkan");
    return NextResponse.json({ ok: false, code: "UNAVAILABLE" }, { status: 503 });
  }
  if (!isCronAuthorized(req.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const { tahun, jumlah } = await refreshPelatihan();
    return NextResponse.json({ ok: true, tahun, jumlah });
  } catch (err) {
    logger.error({ err }, "cron refresh-pelatihan gagal");
    return NextResponse.json({ ok: false, code: "INTERNAL" }, { status: 500 });
  }
}
