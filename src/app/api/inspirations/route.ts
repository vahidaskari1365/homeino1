import { desc, eq } from "drizzle-orm";
import { guard } from "@/lib/api/http";
import { ok, demoUnavailable } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { readSessionToken, getSessionUser } from "@/lib/api/auth";
import { rateLimit, getClientIp } from "@/lib/api/rateLimit";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/db";
import { inspirations } from "@/db/schema";
import { isStyleSlug } from "@/data/styles";
import { slugify } from "@/lib/utils";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Storage bucket provisioned by supabase/migrations (public catalog imagery). */
const BUCKET = "inspiration-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Fixed space taxonomy shared with the upload UI — not data-derived. */
const USER_PIN_ROOMS = ["پذیرایی", "اتاق خواب", "فضای کار", "ناهارخوری", "بیرونی"];

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
}

function supabaseForWrites() {
  // Service role bypasses storage/table RLS (server-side only); the anon
  // client is the fallback and stays subject to RLS — failures surface honestly.
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient() : createSupabaseServerClient();
}

/**
 * Identity resolution: the standard session helper first; when DATABASE_URL is
 * absent it falls back to a raw Supabase token check so deployments with only
 * Supabase configured still get a real author id.
 */
async function resolveAuthorId(req: NextRequest): Promise<string | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  try {
    const ctx = await getSessionUser(token);
    if (ctx) return ctx.user.id;
  } catch {
    // users mirror unavailable — verify the token directly against Supabase
    try {
      const { data, error } = await createSupabaseServerClient().auth.getUser(token);
      if (!error && data.user) return data.user.id;
    } catch {
      /* fall through */
    }
  }
  return null;
}

interface UserPinRow {
  slug: string;
  title: string;
  image: string;
  styleSlug: string;
  room: string;
  tags: string[];
  description: string;
  content: Record<string, unknown>;
  authorId: string;
}

async function insertUserPin(row: UserPinRow): Promise<void> {
  if (process.env.DATABASE_URL) {
    // Genuinely wired path: Drizzle against the agentic-core schema.
    await getDb()
      .insert(inspirations)
      .values({
        slug: row.slug,
        title: row.title,
        image: row.image,
        styleSlug: row.styleSlug,
        room: row.room,
        tags: row.tags,
        description: row.description,
        content: row.content,
        authorId: row.authorId,
        // status defaults to "draft" — editorial approval gate
      })
      .returning({ id: inspirations.id });
    return;
  }
  // No DATABASE_URL — insert through the Supabase client (snake_case columns).
  const { error } = await supabaseForWrites()
    .from("inspirations")
    .insert({
      slug: row.slug,
      title: row.title,
      image: row.image,
      style_slug: row.styleSlug,
      room: row.room,
      tags: row.tags,
      description: row.description,
      content: row.content,
      author_id: row.authorId,
      status: "draft",
    });
  if (error) {
    throw new ApiError("PROVIDER_ERROR", "ذخیره پین در پایگاه داده ناموفق بود", 502, error.message);
  }
}

/** GET /api/inspirations?limit=50 — published user pins (for future surfaces). */
export const GET = guard(async (req) => {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
  if (process.env.DATABASE_URL) {
    const rows = await getDb()
      .select({
        id: inspirations.id,
        slug: inspirations.slug,
        title: inspirations.title,
        image: inspirations.image,
        styleSlug: inspirations.styleSlug,
        room: inspirations.room,
        tags: inspirations.tags,
        description: inspirations.description,
        content: inspirations.content,
        createdAt: inspirations.createdAt,
      })
      .from(inspirations)
      .where(eq(inspirations.status, "published"))
      .orderBy(desc(inspirations.createdAt))
      .limit(limit);
    return ok({ items: rows });
  }
  if (!supabaseConfigured()) {
    return demoUnavailable("فهرست پین‌های کاربران (API)", "در حالت دمو، پین‌های کاربران در دسترس نیستند.");
  }
  const { data, error } = await supabaseForWrites()
    .from("inspirations")
    .select("id,slug,title,image,style_slug,room,tags,description,content,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError("PROVIDER_ERROR", "خواندن پین‌ها ناموفق بود", 502, error.message);
  return ok({ items: data });
});

/**
 * POST /api/inspirations — user photo upload → Supabase storage +
 * `inspirations` row with status "draft" (editorial approval required).
 * Honest degradation: without Supabase env the endpoint returns 503 and never
 * pretends success.
 */
export const POST = guard(async (req) => {
  if (!supabaseConfigured()) {
    return demoUnavailable(
      "ثبت عکس کاربران",
      "ثبت عکس کاربران به‌زودی فعال می‌شود — فعلاً سردبیر هومینو پین‌ها را منتشر می‌کند.",
    );
  }

  await rateLimit(`inspirations:post:${getClientIp(req)}`, { windowMs: 60_000, max: 5 });

  const authorId = await resolveAuthorId(req);
  if (!authorId) throw ApiError.unauthorized("برای انتشار عکس، اول وارد حساب شوید");

  const form = await req.formData().catch(() => null);
  if (!form) throw ApiError.badRequest("فرم ارسال‌شده نامعتبر است");

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) throw ApiError.badRequest("انتخاب عکس الزامی است");
  if (image.size > MAX_IMAGE_BYTES) throw ApiError.badRequest("حجم عکس باید کمتر از ۸ مگابایت باشد");
  if (!ALLOWED_MIME.has(image.type)) throw ApiError.badRequest("فرمت عکس باید JPG، PNG یا WebP باشد");

  const title = String(form.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 120) throw ApiError.badRequest("عنوان باید بین ۳ تا ۱۲۰ نویسه باشد");

  const description = String(form.get("description") ?? "").trim().slice(0, 1000);
  const styleRaw = String(form.get("style") ?? "").trim();
  if (!isStyleSlug(styleRaw)) throw ApiError.badRequest("سبک انتخاب‌شده معتبر نیست");
  const room = String(form.get("space") ?? "").trim();
  if (!USER_PIN_ROOMS.includes(room)) throw ApiError.badRequest("فضای انتخاب‌شده معتبر نیست");
  const items = String(form.get("items") ?? "")
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  // Upload to the inspiration-images bucket, user-scoped path.
  const supabase = supabaseForWrites();
  const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const baseSlug = slugify(title).replace(/-+/g, "-").replace(/^-|-$/g, "") || "pin";
  const path = `${authorId}/${Date.now()}-${baseSlug}.${ext}`;
  const buffer = Buffer.from(await image.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: image.type, upsert: false });
  if (uploadError) {
    throw new ApiError("PROVIDER_ERROR", "بارگذاری عکس روی سرور ناموفق بود", 502, uploadError.message);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = data.publicUrl;

  const content = { format: "user-pin/v1", items, source: null, authorType: "user" };
  const slug = `${baseSlug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  await insertUserPin({
    slug,
    title,
    image: imageUrl,
    styleSlug: styleRaw,
    room,
    tags: [room],
    description,
    content,
    authorId,
  });

  return ok({ slug, status: "draft" }, { status: 201 });
});
