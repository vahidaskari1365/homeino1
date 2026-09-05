import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "هومینو استودیو — پیش‌نمایش چیدمان خانه‌ات",
  description:
    "عکس فضای خودت را بارگذاری کن، سبک را انتخاب کن و نتیجه‌ی چیدمان جدید را قبل از خرید ببین. هومینو استودیو: محصولات واقعی را در عکس خانه‌ات ببین، جای آن‌ها را عوض کن و قبل از خرید نتیجه را ببین.",
  alternates: { canonical: "/ai/design" },
  openGraph: {
    title: "هومینو استودیو — Homeino Studio",
    description: "قبل از خرید، نتیجه را در خانه‌ات ببین.",
    type: "website",
    locale: "fa_IR",
    url: "/ai/design",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Homeino Studio" }],
  },
};

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
