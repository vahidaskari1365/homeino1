import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first-gate for authenticated areas. A valid-looking Supabase session
 * cookie is REQUIRED for /admin, /vendor and /account — unauthenticated
 * visitors are redirected to login with a `next` return path. Role/permission
 * enforcement stays in the server layer (requireAdminUser etc.) — this is
 * UX-level gating, not the security boundary.
 *
 * In demo mode (no Supabase URL configured) the gate is pass-through so the
 * local sample experience keeps working.
 */
const PROTECTED = [/^\/admin(\/|$)/, /^\/vendor(\/|$)/, /^\/account(\/|$)/];

export function hasSessionCookie(req: NextRequest): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return true; // demo mode — no gate
  const match = url.match(/https:\/\/([a-z0-9]+)\./i);
  const ref = match?.[1];
  if (!ref) return true;
  const names = req.cookies.getAll().map((c) => c.name);
  // supabase-js v2 browser storage → our own auth API copies the session into
  // `sb-<ref>-auth-token` (+ .0/.1 chunked) AND plain `sb-access-token`.
  // Matching BOTH keeps authenticated users out of the login redirect loop.
  return (
    names.some((n) => n.startsWith(`sb-${ref}-auth-token`)) || names.includes("sb-access-token")
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/vendor/:path*", "/account/:path*"],
};
