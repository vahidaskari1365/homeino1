import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { newsletterSubscribers } from "@/db/schema/supabase";
import { getClientIp, rateLimit } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@]+@[^@]+\.[^@]+$/;
const PHONE_RE = /^09\d{9}$/;

/**
 * Newsletter capture — real, honest lead storage (no fake success toasts).
 * Accepts email OR Iranian mobile number. Duplicate subscriptions are a
 * silent no-op (single row per contact).
 */
export async function POST(req: Request) {
  try {
    rateLimit(`newsletter:${getClientIp(req)}`, { windowMs: 60_000, max: 5 });
  } catch {
    return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: "درخواست‌ها زیاد است — کمی بعد تلاش کن" }, { status: 429 });
  }

  let body: { email?: unknown; phone?: unknown; source?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "") : "";
  const phone = phoneRaw ? `0${phoneRaw.slice(-10)}` : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "footer";

  if (!email && !phone) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "ایمیل یا شماره موبایل لازم است" }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "ایمیل معتبر نیست" }, { status: 400 });
  }
  if (phone && !PHONE_RE.test(phone)) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "شماره موبایل باید با 09 شروع شود و ۱۱ رقم باشد" }, { status: 400 });
  }

  // No DB → demo mode: honest local echo (client persists nothing fake).
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true, demo: true, message: "در حالت دمو ثبت شد — پس از راه‌اندازی دیتابیس، عضویت واقعی می‌شود" });
  }

  try {
    const db = getDb();
    await db
      .insert(newsletterSubscribers)
      .values({ email: email || null, phone: phone || null, source })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true, message: "عضویت ثبت شد — کد تخفیف به‌زودی برایت ارسال می‌شود" });
  } catch (err) {
    console.error("[newsletter]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "خطای داخلی سرور" }, { status: 500 });
  }
}
