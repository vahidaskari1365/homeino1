import { demoUnavailable, ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { requireUser } from "@/lib/api/auth";
import { gamificationState } from "@/services/gamification";

export const runtime = "nodejs";

/** The full gamification dashboard state for the signed-in user. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("جایزه‌ها (API)");
  const { user } = await requireUser(req);
  const state = await gamificationState(user.id);
  return ok({ state });
});
