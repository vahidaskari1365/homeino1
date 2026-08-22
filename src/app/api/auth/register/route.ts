import { validate, isEmail, isPassword, isOptionalString } from "@/lib/api/validate";
import { sessionCookieName, refreshCookieName } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const input = validate(await readBody(req), {
    email: isEmail, password: isPassword, name: isOptionalString(120), phone: isOptionalString(32),
  });
  rateLimit(`register:${input.email}`, { windowMs: 60_000, max: 8 });
  const { data, error } = await createSupabaseServerClient().auth.signUp({
    email: input.email,
    password: input.password,
    phone: input.phone || undefined,
    options: { data: { name: input.name ?? null } },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw ApiError.conflict("این ایمیل قبلاً ثبت شده است");
    throw ApiError.badRequest(error.message);
  }
  if (!data.user) throw ApiError.badRequest("ثبت‌نام انجام نشد");

  const res = NextResponse.json({ ok: true, data: { id: data.user.id, email: data.user.email, role: "customer", emailConfirmationRequired: !data.session } }, { status: 201 });
  if (data.session) {
    const secure = process.env.NODE_ENV === "production";
    res.cookies.set(sessionCookieName, data.session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in });
    res.cookies.set(refreshCookieName, data.session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  }
  return res;
});
