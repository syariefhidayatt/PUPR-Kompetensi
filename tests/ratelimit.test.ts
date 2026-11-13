import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetMemoryRateLimit } from "@/server/ratelimit";

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetMemoryRateLimit();
});

describe("rateLimit (fallback in-memory)", () => {
  it("mengizinkan sampai batas lalu menolak", async () => {
    expect(await rateLimit("k", 3, 60)).toBe(true);
    expect(await rateLimit("k", 3, 60)).toBe(true);
    expect(await rateLimit("k", 3, 60)).toBe(true);
    expect(await rateLimit("k", 3, 60)).toBe(false);
  });
  it("kunci berbeda tidak saling mempengaruhi", async () => {
    await rateLimit("a", 1, 60);
    expect(await rateLimit("a", 1, 60)).toBe(false);
    expect(await rateLimit("b", 1, 60)).toBe(true);
  });
});

describe("clientIp", () => {
  it("mengambil IP pertama dari x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
