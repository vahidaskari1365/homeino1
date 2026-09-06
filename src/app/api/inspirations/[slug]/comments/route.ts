import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit, getClientIp } from "@/lib/api/rateLimit";
import { optionalUser } from "@/lib/api/auth";
import { getInspiration } from "@/data/inspirations";
import {
  addComment,
  listThreads,
  COMMENT_BODY_MIN,
  COMMENT_BODY_MAX,
  COMMENT_NAME_MIN,
  COMMENT_NAME_MAX,
} from "@/services/inspirationComments";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

async function requirePin(slug: string) {
  const pin = getInspiration(slug);
  if (!pin) throw ApiError.notFound("این پین پیدا نشد");
  return pin;
}

/** GET — the discussion thread of one pin (works in demo: local store). */
export const GET = guard(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  await requirePin(slug);
  const threads = await listThreads(slug);
  return ok({ items: threads });
});

/**
 * POST — add a comment (guest or logged-in). Honest validation, rate-limited;
 * single-level replies via `parentId`.
 */
export const POST = guard(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  await requirePin(slug);

  await rateLimit(`insp-comments:post:${getClientIp(req)}`, { windowMs: 60_000, max: 8 });

  const body = (await readBody(req)) as {
    body?: unknown;
    name?: unknown;
    parentId?: unknown;
  } | null;
  if (!body) throw ApiError.badRequest("بدنه درخواست نامعتبر است");

  const text = String(body.body ?? "").trim();
  if (text.length < COMMENT_BODY_MIN || text.length > COMMENT_BODY_MAX) {
    throw ApiError.badRequest(`متن نظر باید بین ${COMMENT_BODY_MIN} تا ${COMMENT_BODY_MAX} نویسه باشد`);
  }
  const name = String(body.name ?? "").trim();
  if (name.length < COMMENT_NAME_MIN || name.length > COMMENT_NAME_MAX) {
    throw ApiError.badRequest("نام باید بین ۲ تا ۴۰ نویسه باشد");
  }
  const parentId = body.parentId ? String(body.parentId) : null;

  let authorId: string | null = null;
  try {
    const { userId } = await optionalUser(req);
    authorId = userId;
  } catch {
    /* guest comment — identity stays null */
  }

  try {
    const item = await addComment({ pinId: slug, body: text, authorName: name, parentId, authorId });
    return ok({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof RangeError) {
      if (err.message === "parent-missing") throw ApiError.badRequest("نظری که پاسخ می‌دهی پیدا نشد");
      throw ApiError.badRequest("متن یا نام ارسالی معتبر نیست");
    }
    throw err;
  }
});
