import type { NextConfig } from "next";

/**
 * Homeino — Next.js production configuration.
 *
 *  • Image optimization enabled for our stock CDN (Pexels).
 *  • Security headers hardened (HSTS, Referrer-Policy, Frame guard, etc.).
 *  • `/ai` legacy visits redirect straight into the AI Designer at `/ai/design` (no intro page).
 *  • Server-only providers keep AI/LLM keys out of the client bundle
 *    (see `src/services/ai/provider.ts` — they are never re-exported).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    // Remote sources the app is allowed to optimize.
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.homeino.ir" },
      { protocol: "https", hostname: "sfile.chatglm.cn" },
      { protocol: "https", hostname: "z-cdn.chatglm.cn" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1440, 1920],
    imageSizes: [64, 96, 128, 200, 256, 320, 400],
    minimumCacheTTL: 60 * 60 * 24, // 1 day
  },

  async redirects() {
    return [
      {
        // AI entry is DIRECT: the AI Designer lives at /ai/design; the old
        // /ai intro page is gone, so legacy visits land on the Designer —
        // no intro page ever again. Query strings (e.g. ?session=…) are
        // forwarded.
        source: "/ai",
        destination: "/ai/design",
        permanent: false,
      },
    ];
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        // ENFORCING policy. script-src keeps 'unsafe-inline'/'unsafe-eval'
        // because the Next.js App Router bootstrap requires them without a
        // nonce infrastructure; every other directive is genuinely
        // restrictive: frame-ancestors kills clickjacking, object-src
        // 'none' blocks plugin content, base-uri/form-action lock navigation.
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "upgrade-insecure-requests",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "media-src 'self' blob:",
          "connect-src 'self' https:",
          "worker-src 'self' blob:",
        ].join("; "),
      },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      // Long-lived cache for the hero video (immutable public asset).
      {
        source: "/video/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
