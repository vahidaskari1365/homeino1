import { ApiError } from "./errors";

/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for per-process protection (per route + identity key). For
 * multi-instance deployments swap for a shared store (Redis), keeping the
 * same interface.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function rateLimit(key: string, opts: RateLimitOptions = {}) {
  const { windowMs = 60_000, max = 120 } = opts;
  const now = Date.now();
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
}
