import type { Metadata } from "next";

// Search-results pages should not compete with real landing pages in the
// index (Google guideline: noindex internal search results). Crawling stays
// allowed so the directive is actually visible to bots; the route is also
// excluded from sitemap.ts to keep the two signals consistent.
export const metadata: Metadata = {
  title: "جستجو",
  description: "میان محصولات، فروشگاه‌ها، سبک‌ها و الهام‌های Homeino جستجو کن.",
  robots: { index: false, follow: true },
  openGraph: {
    title: "جستجو — Homeino",
    description: "میان محصولات، فروشگاه‌ها و الهام‌ها جستجو کن.",
    type: "website",
    locale: "fa_IR",
    url: "/search",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
