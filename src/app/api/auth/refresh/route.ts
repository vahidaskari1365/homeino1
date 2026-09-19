import { sessionCookieName, refreshCookieName } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Session refresh: exchanges the httpOnly `sb-refresh-token` cookie for a
 * fresh access token. This closes the ~1h "session cliff" where the access
 * cookie expires while the refresh cookie (30d) is still valid — commerceClient
 * retries 401s through this endpoint transparently.
 */
export const POST = guard(async (req) => {
  const body = (await readBody(req).catch(() => ({}))) as Record<string, unknown>;
  const cookieToken = req.cookies.get(refreshCookieName)?.value ?? null;
  const refreshToken = (typeof body.refreshToken === "string" && body.refreshToken) || cookieToken;
  if (!refreshToken) throw ApiError.unauthorized("نشستی برای تمدید وجود ندارد");

  const { data, error } = await createSupabaseServerClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) throw ApiError.unauthorized("نشست منقضی شده — دوباره وارد شو");

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true, data: { id: data.user.id, email: data.user.email } });
  res.cookies.set(sessionCookieName, data.session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in });
  // Supabase may rotate the refresh token — persist the newest one.
  res.cookies.set(refreshCookieName, data.session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return res;
});
