import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSessions, users, profiles } from "@/db/schema";
import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { Role, hasPermission, Permission } from "../auth/permissions";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "homeino_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const KEYLEN = 64;

// ---------------------------------------------------------------
// Password hashing — Node scrypt (CPU/memory-hard, no external deps)
// ---------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const key = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------
export async function createSession(
  userId: string,
  opts?: { ttlMs?: number; ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const ttl = opts?.ttlMs ?? SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  await getDb().insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    ip: opts?.ip,
    userAgent: opts?.userAgent,
  });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  if (!token) return null;
  const hash = sha256(token);
  const db = getDb();
  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.tokenHash, hash))
    .limit(1);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || user.status === "suspended") return null;
  return { user, session };
}

export async function revokeSession(token: string) {
  const db = getDb();
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.tokenHash, sha256(token)));
}

export function readSessionToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  return cookie ?? null;
}

export const sessionCookieName = SESSION_COOKIE;

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

/** Attach a default profile row so name/avatar reads never 404. */
export async function ensureProfile(userId: string) {
  const db = getDb();
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing.length) return existing[0];
  await db.insert(profiles).values({ userId });
  return (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0];
}
