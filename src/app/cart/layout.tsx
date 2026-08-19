import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سبد خرید",
  description: "بررسی و ویرایش سبد خرید Homeino.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
