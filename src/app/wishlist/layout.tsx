import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "علاقه‌مندی‌های من",
  description: "محصولات، الهام‌ها، طراحی‌های AI و فروشگاه‌های ذخیره‌شده در یک جا.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: true },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
