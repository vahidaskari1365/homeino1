import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الهام — گالری فضاهای واقعی خانه",
  description:
    "الهام بگیر، ذخیره کن و همان چیدمان را از فروشگاه Homeino بخر. تصاویر واقعی از خانه‌ها با محصولات قابل‌خرید.",
  alternates: { canonical: "/inspiration" },
  openGraph: {
    title: "گالری الهام — Homeino",
    description: "الهام بگیر و همان چیدمان را بخر.",
    type: "website",
    locale: "fa_IR",
    url: "/inspiration",
  },
};

export default function InspirationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
