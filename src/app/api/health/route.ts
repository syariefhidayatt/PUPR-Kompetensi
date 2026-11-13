import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

// Health check: memastikan app hidup dan Neon terjangkau. Error detail hanya ke log.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    logger.error({ err }, "health check: database tidak terjangkau");
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
