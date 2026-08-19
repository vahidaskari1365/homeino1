import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "فروشگاه‌های معتبر خانه و دکوراسیون",
  description:
    "فروشگاه‌های تأییدشده‌ی Homeino با هویت، امتیاز و سابقه شفاف — با اطمینان کامل خرید کن.",
  alternates: { canonical: "/stores" },
  openGraph: {
    title: "فروشگاه‌های معتبر — Homeino",
    description: "فروشگاه‌های تأییدشده با هویت و امتیاز شفاف.",
    type: "website",
    locale: "fa_IR",
    url: "/stores",
  },
};

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
