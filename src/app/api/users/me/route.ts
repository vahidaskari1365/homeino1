import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/api/auth";
import { ensureProfile } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isOptionalString, isOptionalObject } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  const profile = await ensureProfile(user.id);
  return ok({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    name: profile.name,
    avatar: profile.avatar,
    bio: profile.bio,
    locale: profile.locale,
    timezone: profile.timezone,
    preferences: profile.preferences,
    createdAt: user.createdAt,
  });
});

export const PATCH = guard(async (req) => {
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    name: isOptionalString(120),
    avatar: isOptionalString(2000),
    bio: isOptionalString(1000),
    locale: isOptionalString(16),
    timezone: isOptionalString(64),
    preferences: isOptionalObject,
  });
  await getDb()
    .update(profiles)
    .set({
      name: input.name as string | undefined,
      avatar: input.avatar as string | undefined,
      bio: input.bio as string | undefined,
      locale: input.locale as string | undefined,
      timezone: input.timezone as string | undefined,
      preferences: input.preferences as never,
    })
    .where(eq(profiles.userId, user.id));
  return ok(await ensureProfile(user.id));
});