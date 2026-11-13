import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/server/logger";

// Membaca process.env langsung (bukan "@/env") agar mudah diuji.
const memory = new Map<string, { count: number; resetAt: number }>();
const limiters = new Map<string, Ratelimit>();

function upstash(limit: number, windowSec: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cacheKey = `${limit}:${windowSec}`;
  let rl = limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "rl",
    });
    limiters.set(cacheKey, rl);
  }
  return rl;
}

/** true = boleh lanjut, false = terkena limit. Fail-open bila Upstash gagal (dicatat ke log). */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const rl = upstash(limit, windowSec);
  if (rl) {
    try {
      return (await rl.limit(key)).success;
    } catch (err) {
      logger.error({ err }, "rate limit: Upstash gagal, fail-open");
      return true;
    }
  }

  // Fallback in-memory: hanya per-instance, cukup untuk dev. Produksi serverless wajib Upstash.
  const now = Date.now();
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetMemoryRateLimit() {
  memory.clear();
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
