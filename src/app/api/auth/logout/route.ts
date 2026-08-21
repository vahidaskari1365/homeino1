import { revokeSession, sessionCookieName, readSessionToken } from "@/lib/api/auth";
import { guard } from "@/lib/api/http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = guard(async (req) => {
  const token = readSessionToken(req);
  if (token) await revokeSession(token);
  const res = NextResponse.json({ ok: true, data: {} });
  res.cookies.set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});