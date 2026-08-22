import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بازیابی رمز عبور",
  description: "با ایمیل خود لینک بازیابی رمز حساب Homeino را دریافت کن.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
