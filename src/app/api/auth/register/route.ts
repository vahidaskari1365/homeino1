import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { validate, isEmail, isPassword, isOptionalString } from "@/lib/api/validate";
import { createSession, hashPassword, sessionCookieName } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const body = await readBody(req);
  const input = validate(body, {
    email: isEmail,
    password: isPassword,
    name: isOptionalString(120),
    phone: isOptionalString(32),
  });

  rateLimit(`register:${input.email}`, { windowMs: 60_000, max: 8 });

  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length) throw ApiError.conflict("این ایمیل قبلاً ثبت شده است");

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, phone: input.phone ?? null, passwordHash, role: "customer", status: "active", emailVerifiedAt: new Date() })
    .returning();
  await db.insert(profiles).values({ userId: user.id, name: input.name ?? null });

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json(
    { ok: true, data: { id: user.id, email: user.email, role: user.role } },
    { status: 201 },
  );
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return res;
});
