import { ApiError } from "./errors";

/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for per-process protection (per route + identity key). For
 * multi-instance deployments swap for a shared store (Redis), keeping the
 * same interface.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

const CLEAN_EVERY_MS = 60_000;
/** Drop buckets whose newest stamp is older than this. */
const STALE_AFTER_MS = 5 * 60_000;
let lastCleanupAt = 0;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

function isValidIp(value: string): boolean {
  if (!value || value.length > 45) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  // IPv6 (including compressed / IPv4-mapped). Reject obvious junk.
  if (value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value)) return true;
  return false;
}

/**
 * Identify the caller IP conservatively:
 *   1. `x-real-ip` (set by the trusted edge / reverse proxy)
 *   2. last valid hop of `x-forwarded-for` (the hop the proxy itself appended)
 *
 * The first XFF hop is client-controlled and therefore ignored.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const real = (req.headers.get("x-real-ip") ?? "").trim();
  if (isValidIp(real)) return real;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      if (isValidIp(hops[i])) return hops[i];
    }
  }
  return "unknown";
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < CLEAN_EVERY_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < STALE_AFTER_MS);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export function rateLimit(key: string, opts: RateLimitOptions = {}) {
  const { windowMs = 60_000, max = 120 } = opts;
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= max) {
    throw ApiError.rateLimited();
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return bucket.timestamps.length;
}

/** Tidy: drop stale buckets periodically so the map never grows unbounded. */
export function resetRateLimits() {
  buckets.clear();
  lastCleanupAt = 0;
}
