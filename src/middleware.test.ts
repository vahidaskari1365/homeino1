import { describe, expect, it, beforeEach, vi } from "vitest";
import { hasSessionCookie } from "./middleware";
import { NextRequest } from "next/server";

function req(cookies: string[] = [], url = "https://homeino.ir/account"): NextRequest {
  const req = new NextRequest(url);
  for (const c of cookies) req.cookies.set(c, "tok");
  return req;
}

describe("middleware session gate (cookie recognition)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://yydmibcmajxpqybtfgxm.supabase.co");
  });

  it("recognizes the chunked supabase-js cookie", () => {
    expect(hasSessionCookie(req(["sb-yydmibcmajxpqybtfgxm-auth-token.0"]))).toBe(true);
  });

  it("recognizes our own sb-access-token cookie (auth API session)", () => {
    expect(hasSessionCookie(req(["sb-access-token"]))).toBe(true);
  });

  it("redirects users with no recognizable session cookie", () => {
    expect(hasSessionCookie(req(["other=cookie"]))).toBe(false);
    expect(hasSessionCookie(req([]))).toBe(false);
  });

  it("demo mode (no SUPABASE URL) is pass-through", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      expect(hasSessionCookie(req([]))).toBe(true);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });
});
