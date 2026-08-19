import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ساخت حساب کاربری",
  description: "به Homeino بپیوند و از تجربه خرید، الهام و طراحی هوشمند استفاده کن.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
