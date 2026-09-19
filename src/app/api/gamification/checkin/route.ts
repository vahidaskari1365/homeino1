import { demoUnavailable, ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireUser } from "@/lib/api/auth";
import { checkInDaily } from "@/services/gamification";

export const runtime = "nodejs";

/** Daily check-in — escalating streak credits (reset after a missed day). */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ورود روزانه (API)");
  const { user } = await requireUser(req);
  await rateLimit(`checkin:${user.id}`, { windowMs: 60_000, max: 10 });
  return ok(await checkInDaily(user.id));
});
