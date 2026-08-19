import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // AI entry is DIRECT: /ai/design (old studio link) always lands on
        // the AI Designer at /ai — no intro page ever again. Query strings
        // (e.g. ?session=…) are forwarded.
        source: "/ai/design",
        destination: "/ai",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
