import { demoUnavailable, ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireUser } from "@/lib/api/auth";
import { spinDaily } from "@/services/gamification";

export const runtime = "nodejs";

/**
 * Daily spin — one free spin per Tehran-day, always wins REAL credits.
 * The unique (user, day) index is the cap; a race reads the winner's row.
 */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("چرخ شانس (API)");
  const { user } = await requireUser(req);
  await rateLimit(`spin:${user.id}`, { windowMs: 60_000, max: 10 });
  return ok(await spinDaily(user.id));
});
