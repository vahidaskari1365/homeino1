import { NextResponse } from "next/server";
import { ApiError } from "./errors";

/**
 * Standard response envelope used by every Homeino API route.
 * Success:  { ok: true, data }
 * Failure:  { ok: false, error: { code, message, details? } }
 */

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false as const,
        error: { code: error.code, message: error.message, details: error.details },
      },
      { status: error.status },
    );
  }
  const message =
    error instanceof Error ? error.message : "خطای ناشناخته‌ای رخ داد";
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", error);
  return NextResponse.json(
    { ok: false as const, error: { code: "INTERNAL", message } },
    { status: 500 },
  );
}

/** Paginated success shape — meta carries total/page/limit. */
export function page<T>(
  items: T,
  meta: { total: number; page: number; limit: number; hasMore: boolean },
) {
  return ok({ items, meta });
}
