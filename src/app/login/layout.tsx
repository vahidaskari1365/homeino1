import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ورود به حساب",
  description: "برای دسترسی به سفارش‌ها، کالکشن‌ها و طراحی‌های ذخیره‌شده وارد حساب Homeino شو.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
