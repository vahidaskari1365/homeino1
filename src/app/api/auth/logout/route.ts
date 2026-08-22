import { refreshCookieName, sessionCookieName, readSessionToken } from "@/lib/api/auth";
import { guard } from "@/lib/api/http";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const token = readSessionToken(req);
  if (token && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await createSupabaseAdminClient().auth.admin.signOut(token, "local").catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true, data: {} });
  res.cookies.set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(refreshCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
