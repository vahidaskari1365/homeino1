import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fail } from "./response";
import { ApiError } from "./errors";

/**
 * Wrap a route handler so every ApiError / thrown error becomes the standard
 * JSON error envelope and nothing leaks stack traces.
 * Passes through the dynamic-route `{ params }` context.
 */
export function guard<T extends { params?: Promise<unknown> } = { params?: Promise<unknown> }>(
  fn: (req: NextRequest, ctx: T) => Promise<Response | NextResponse | { status?: number; data: unknown }>,
) {
  return async (req: NextRequest, ctx: T): Promise<NextResponse> => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response && "cookies" in out) return out as NextResponse;
      if (out instanceof Response) return NextResponse.json({ ok: true, data: await safeJson(out) });
      return NextResponse.json({ ok: true, data: (out as { data: unknown }).data }, {
        status: (out as { status?: number }).status ?? 200,
      });
    } catch (err) {
      return fail(err);
    }
  };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function readBody(req: NextRequest, maxBytes = 1_000_000): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text) return {};
    if (text.length > maxBytes) throw ApiError.badRequest("پرداخت بیش از حد بزرگ است");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest("JSON نامعتبر است");
  }
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));
  return { page, limit };
}