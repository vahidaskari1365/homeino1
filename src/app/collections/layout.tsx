import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "کالکشن‌های من — محصولات ذخیره‌شده",
  description: "محصولات موردعلاقه‌ات را در کالکشن‌های شخصی سازمان‌دهی کن و بعداً به‌سرعت پیدا کن.",
  alternates: { canonical: "/collections" },
  robots: { index: false, follow: true },
};

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
