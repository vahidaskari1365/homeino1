import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { rateLimit, resetRateLimits, getClientIp } from "./rateLimit";
import { ApiError } from "./errors";

/**
 * NOTE: these tests exercise the TIER-2 (in-memory) path — DATABASE_URL is
 * cleared so the shared DB tier never engages (no network in unit tests).
 */
describe("rateLimit (memory tier)", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    resetRateLimits();
  });
  afterAll(() => vi.unstubAllEnvs());

  it("allows hits under the max and counts them", async () => {
    for (let i = 1; i <= 5; i++) {
      const n = await rateLimit("test:a", { windowMs: 60_000, max: 5 });
      expect(n).toBe(i);
    }
  });

  it("throws RATE_LIMITED once the max is exceeded", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("test:b", { windowMs: 60_000, max: 3 });
    await expect(rateLimit("test:b", { windowMs: 60_000, max: 3 })).rejects.toThrowError(ApiError);
  });

  it("isolates buckets by key", async () => {
    await rateLimit("test:c", { windowMs: 60_000, max: 1 });
    const n = await rateLimit("test:d", { windowMs: 60_000, max: 1 });
    expect(n).toBe(1);
  });

  it("resets the window after it elapses", async () => {
    vi.useFakeTimers();
    await rateLimit("test:e", { windowMs: 1_000, max: 1 });
    vi.advanceTimersByTime(1_500);
    const n = await rateLimit("test:e", { windowMs: 1_000, max: 1 });
    expect(n).toBe(1);
    vi.useRealTimers();
  });
});

describe("getClientIp (spoof-resistant)", () => {
  const req = (headers: Record<string, string>) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });

  it("prefers x-real-ip", () => {
    expect(getClientIp(req({ "x-real-ip": "10.1.2.3", "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("10.1.2.3");
  });

  it("takes the LAST valid XFF hop (proxy-appended), not the client-controlled first", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("rejects junk IPs and falls back to unknown", () => {
    expect(getClientIp(req({ "x-real-ip": "999.1.2.3" }))).toBe("unknown");
    expect(getClientIp(req({ "x-real-ip": "<script>" }))).toBe("unknown");
  });
});
