import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "همه محصولات — بازارگاه Homeino",
  description:
    "کشف و مقایسه هزاران محصول خانه و دکوراسیون از فروشگاه‌های معتبر ایران — با فیلترهای دقیق قیمت، سبک، رنگ و امتیاز.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "همه محصولات — بازارگاه Homeino",
    description: "کشف و مقایسه محصولات خانه و دکوراسیون از فروشگاه‌های معتبر.",
    type: "website",
    locale: "fa_IR",
    url: "/products",
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
