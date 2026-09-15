// ============================================================
// SITE CONFIG — canonical base URL + brand primitives.
// Everything in the app that generates absolute URLs (sitemap,
// robots, JSON-LD, OpenGraph) should import from here so there
// is a SINGLE source of truth.
//
// Precedence for base URL:
//   1. NEXT_PUBLIC_SITE_URL  (explicit override, set in Vercel if needed)
//   2. Production deploys    → https://homeino.ir  (ALWAYS the brand domain —
//      never the per-deploy VERCEL_URL, otherwise canonicals/sitemap/JSON-LD
//      rotate with every deployment and point away from the money domain)
//   3. VERCEL_URL            (preview deploys keep their own URL)
//   4. https://homeino.ir    (local dev fallback)
//
// DOMAIN SWITCH NOTE (recorded 2026-09-15): the owner plans to register
// homeino.com next month and may use it as the final brand domain. The switch
// is CONFIG-ONLY — no code change needed:
//   1. Set NEXT_PUBLIC_SITE_URL=https://homeino.com in Vercel env vars
//   2. Add + verify the domain in Vercel / DNS
//   3. Update SITE.domain + twitter below, Search Console property + sitemap ping
// Until then every canonical keeps pointing at the configured brand domain.
// ============================================================

const raw =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === "production"
    ? "https://homeino.ir"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://homeino.ir");

export const SITE_URL: string = raw.replace(/\/+$/, "");

export const SITE = {
  name: "Homeino",
  brand: "Homeino",
  domain: "homeino.ir",
  url: SITE_URL,
  locale: "fa_IR",
  twitter: "@homeino",
  ogImage: "/og-default.png",
};

/** Build a canonical absolute URL for a route path. */
export function absoluteUrl(path: string = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
