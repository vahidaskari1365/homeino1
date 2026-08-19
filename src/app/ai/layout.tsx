import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "طراحی هوشمند — پیش‌نمایش چیدمان با هوش مصنوعی",
  description:
    "عکس فضای خودت را بارگذاری کن، سبک را انتخاب کن و نتیجه‌ی چیدمان جدید را قبل از خرید ببین. ارائه‌شده با موتور هوش مصنوعی Homeino.",
  alternates: { canonical: "/ai" },
  openGraph: {
    title: "طراحی هوشمند — Homeino AI",
    description: "قبل از خرید، نتیجه را در خانه‌ات ببین.",
    type: "website",
    locale: "fa_IR",
    url: "/ai",
  },
};

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
