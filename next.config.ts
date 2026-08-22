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
