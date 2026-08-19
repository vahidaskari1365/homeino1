import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پرداخت امن",
  description: "تکمیل خرید و پرداخت امن.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
