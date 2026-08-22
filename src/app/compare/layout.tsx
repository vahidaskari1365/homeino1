import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مقایسه محصولات",
  description: "محصولات را کنار هم بگذار و بهترین انتخاب برای خانه‌ات را پیدا کن.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: true },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
