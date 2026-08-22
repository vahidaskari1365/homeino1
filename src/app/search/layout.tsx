import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "جستجو",
  description: "میان محصولات، فروشگاه‌ها، سبک‌ها و الهام‌های Homeino جستجو کن.",
  alternates: { canonical: "/search" },
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
