import { validate, isEmail, isPassword } from "@/lib/api/validate";
import { sessionCookieName, refreshCookieName } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const input = validate(await readBody(req), { email: isEmail, password: isPassword });
  await rateLimit(`login:${input.email}`, { windowMs: 60_000, max: 10 });
  const { data, error } = await createSupabaseServerClient().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.session || !data.user) throw ApiError.unauthorized("ایمیل یا رمز عبور اشتباه است");

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true, data: { id: data.user.id, email: data.user.email, role: data.user.app_metadata.role ?? "customer" } });
  res.cookies.set(sessionCookieName, data.session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in });
  res.cookies.set(refreshCookieName, data.session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return res;
});
