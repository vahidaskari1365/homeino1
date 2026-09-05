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
  console.error("[api] unhandled error:", error);
  return NextResponse.json(
    { ok: false as const, error: { code: "INTERNAL", message: "خطای داخلی سرور" } },
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

/**
 * Honest DB-less response (503): called by routes whose service layer needs a
 * real database. Returns the agreed envelope instead of ever throwing a 500:
 *   { ok: false, code: "DEMO_MODE", message }
 */
export function demoUnavailable(feature: string, message?: string) {
  return NextResponse.json(
    {
      ok: false as const,
      code: "DEMO_MODE" as const,
      message:
        message ??
        `${feature} در حالت دمو (بدون DATABASE_URL) در دسترس نیست. داده‌های این بخش به‌صورت محلی/نمونه نمایش داده می‌شوند و با راه‌اندازی سرور واقعی فعال می‌گردد.`,
    },
    { status: 503 },
  );
}
