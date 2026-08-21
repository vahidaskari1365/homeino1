import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { validate, isEmail, isPassword } from "@/lib/api/validate";
import { createSession, sessionCookieName, verifyPassword } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const body = await readBody(req);
  const input = validate(body, { email: isEmail, password: isPassword });

  rateLimit(`login:${input.email}`, { windowMs: 60_000, max: 10 });

  const [user] = await getDb().select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw ApiError.unauthorized("ایمیل یا رمز عبور اشتباه است");
  }
  if (user.status === "suspended") throw ApiError.forbidden("حساب شما مسدود شده است");

  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const { token, expiresAt } = await createSession(user.id, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  const res = NextResponse.json({
    ok: true,
    data: { id: user.id, email: user.email, role: user.role },
  });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return res;
});