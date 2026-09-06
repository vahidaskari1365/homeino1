import { ApiError } from "./errors";
import { sql } from "drizzle-orm";

/**
 * Two-tier rate limiter.
 *
 * Tier 1 (shared, authoritative when DATABASE_URL is set): the `rate_limits`
 * table — one atomic UPSERT advances the counter for the current window, so
 * ALL serverless instances share the same buckets. One extra indexed query
 * only on rate-limited surfaces (AI, auth) — acceptable and correct.
 *
 * Tier 2 (fallback): per-process sliding window, used when the DB is absent
 * (demo mode) or briefly unreachable — fail-open to local, never break the
 * route because the limiter store hiccuped.
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

function memoryLimit(key: string, windowMs: number, max: number): number {
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

type Sql = {
  execute: (query: unknown) => Promise<{ rows: Array<{ count: number }> }>;
};

/** Atomic shared-window hit. Returns the new count, or null when unavailable. */
async function sharedLimit(key: string, windowMs: number, max: number): Promise<number | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    // Lazy import so edge/demo bundles never pull the driver.
    const { getDb } = await import("@/db");
    const db = getDb() as unknown as Sql;
    // Reset the counter when the last hit started BEFORE the current window;
    // otherwise increment. One statement = race-free across instances.
    const res = await db.execute(sql`
      insert into rate_limits (key, count, window_start, updated_at)
      values (${key}, 1, now(), now())
      on conflict (key) do update set
        count = case
          when rate_limits.window_start < now() - (${`${Math.max(1, windowMs)} milliseconds`})::interval
            then 1 else rate_limits.count + 1 end,
        window_start = case
          when rate_limits.window_start < now() - (${`${Math.max(1, windowMs)} milliseconds`})::interval
            then now() else rate_limits.window_start end,
        updated_at = now()
      returning count
    `);
    const count = Number(res.rows?.[0]?.count ?? 0);
    if (count > max) throw ApiError.rateLimited();
    return count;
  } catch (err) {
    // A limiter outage must never take the route down — but a genuine
    // rate-limit rejection (ApiError) still propagates.
    if (err instanceof ApiError) throw err;
    return null;
  }
}

export async function rateLimit(key: string, opts: RateLimitOptions = {}): Promise<number> {
  const { windowMs = 60_000, max = 120 } = opts;
  const shared = await sharedLimit(key, windowMs, max);
  if (shared !== null) return shared;
  return memoryLimit(key, windowMs, max);
}

/** Tidy: drop stale buckets periodically so the map never grows unbounded. */
export function resetRateLimits() {
  buckets.clear();
  lastCleanupAt = 0;
}
