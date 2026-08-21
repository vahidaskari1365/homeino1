import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, profiles } from "@/db/schema";
import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { Role, hasPermission, Permission } from "../auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const sessionCookieName = "sb-access-token";
export const refreshCookieName = "sb-refresh-token";

export function readSessionToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return req.cookies.get(sessionCookieName)?.value ?? null;
}

export async function getSessionUser(token: string) {
  if (!token) return null;
  const { data, error } = await createSupabaseServerClient().auth.getUser(token);
  if (error || !data.user) return null;

  const db = getDb();
  let [user] = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);
  // The database trigger normally creates this mirror. The upsert also makes
  // deployments resilient while a trigger migration is being rolled out.
  if (!user) {
    [user] = await db.insert(users).values({
      id: data.user.id,
      email: data.user.email ?? `${data.user.id}@auth.local`,
      phone: data.user.phone ?? null,
      role: "customer",
      status: "active",
      emailVerifiedAt: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
    }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);
  }
  if (!user || user.status === "suspended") return null;
  return { user, authUser: data.user, session: { accessToken: token } };
}

export async function revokeSession(_token: string) {
  // Supabase owns refresh-token revocation. API logout calls auth.signOut using
  // the active bearer token and then clears both secure cookies.
}

export async function requireUser(req: NextRequest) {
  const token = readSessionToken(req);
  const ctx = token ? await getSessionUser(token) : null;
  if (!ctx) throw ApiError.unauthorized();
  return { token, ...ctx };
}

export async function requireRole(req: NextRequest, role: Role) {
  const ctx = await requireUser(req);
  if (ctx.user.role !== role) throw ApiError.forbidden();
  return ctx;
}

export async function requirePermission(req: NextRequest, perm: Permission) {
  const ctx = await requireUser(req);
  if (!hasPermission(ctx.user.role as Role, perm)) throw ApiError.forbidden();
  return ctx;
}

export async function ensureProfile(userId: string) {
  const db = getDb();
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing.length) return existing[0];
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
  return (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0];
}
