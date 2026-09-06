import { validate, isEmail, isPassword } from "@/lib/api/validate";
import { sessionCookieName, refreshCookieName } from "@/lib/api/auth";
import { guard, readBody } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";

/**
 * First-admin bootstrap: a fresh deployment has no admin yet, and the
 * owner should never need raw SQL just to unlock their own panel.
 * If NO admin exists in the users table, the first account to sign in
 * is promoted. Once any admin exists, this never fires again.
 * (Best-effort: without DATABASE_URL it silently skips — role stays
 * enforced by requireAdminUser.)
 */
async function bootstrapFirstAdmin(authUser: { id: string; email?: string | null }): Promise<string | null> {
  try {
    const db = getDb();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (Number(count) > 0) return null;
    // ensure the mirror row exists (trigger normally does this)
    let [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
    if (!row) {
      [row] = await db
        .insert(users)
        .values({ id: authUser.id, email: authUser.email ?? `${authUser.id}@auth.local`, role: "admin", status: "active" })
        .onConflictDoNothing()
        .returning();
      if (!row) [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
    }
    await db.update(users).set({ role: "admin" }).where(eq(users.id, authUser.id));
    return "admin";
  } catch {
    return null; // demo mode / DB not wired — skip silently
  }
}

export const POST = guard(async (req) => {
  const input = validate(await readBody(req), { email: isEmail, password: isPassword });
  await rateLimit(`login:${input.email}`, { windowMs: 60_000, max: 10 });
  const { data, error } = await createSupabaseServerClient().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.session || !data.user) throw ApiError.unauthorized("ایمیل یا رمز عبور اشتباه است");

  // If the deployment has no admin yet, the first sign-in claims it.
  const dbRole = await bootstrapFirstAdmin({ id: data.user.id, email: data.user.email });

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true, data: { id: data.user.id, email: data.user.email, role: dbRole ?? data.user.app_metadata.role ?? "customer" } });
  res.cookies.set(sessionCookieName, data.session.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in });
  res.cookies.set(refreshCookieName, data.session.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return res;
});
