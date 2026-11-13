import type { NextRequest } from "next/server";
import { handlers } from "@/server/auth/auth";
import { clientIp, rateLimit } from "@/server/ratelimit";

export const { POST } = handlers;

export async function GET(req: NextRequest) {
  // Throttle IP pada callback Google (D9).
  if (req.nextUrl.pathname.endsWith("/callback/google")) {
    const ok = await rateLimit(`google-cb:${clientIp(req.headers)}`, 20, 600);
    if (!ok) return new Response("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.", { status: 429 });
  }
  return handlers.GET(req);
}
