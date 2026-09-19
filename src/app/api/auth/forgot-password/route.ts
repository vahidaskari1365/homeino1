import { guard, readBody } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { validate, isEmail } from "@/lib/api/validate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Real password-reset request → Supabase sends the recovery email.
 * The link lands on /reset-password which completes the flow client-side.
 * Response is always ok:true (no account enumeration) unless input is invalid.
 */
export const POST = guard(async (req) => {
  const input = validate(await readBody(req), { email: isEmail });
  await rateLimit(`forgot:${input.email}`, { windowMs: 60_000, max: 5 });

  const origin = new URL(req.url).origin;
  const { error } = await createSupabaseServerClient().auth.resetPasswordForEmail(input.email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) {
    // Rate/limit or provider outage — log server-side, answer generically.
    console.error("[auth:forgot-password]", error.message);
  }
  return Response.json({ ok: true, data: { sent: true } });
});
