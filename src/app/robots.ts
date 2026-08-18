import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/vendor/", "/account/", "/cart", "/checkout"],
      },
    ],
    sitemap: "https://homeino.ir/sitemap.xml",
    host: "https://homeino.ir",
  };
}
