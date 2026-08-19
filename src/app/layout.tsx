import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://homeino.ir"),
  title: {
    default: "Homeino | هر آنچه برای خانه‌ی رویایی‌ات لازم داری",
    template: "%s | Homeino",
  },
  description:
    "Homeino — پلتفرم جامع خانه و بازارگاه چندفروشگاهی دکوراسیون. الهام بگیر، محصولات و فروشگاه‌ها را کشف و مقایسه کن و با اطمینان خرید کن.",
  keywords: ["خرید مبلمان", "بازارگاه دکوراسیون", "دکوراسیون", "طراحی داخلی", "فروشگاه خانه", "Homeino"],
  openGraph: {
    title: "Homeino | بازارگاه خانه و دکوراسیون",
    description: "الهام، محصول، فروشگاه، مقایسه و خرید مطمئن — همه در یک مکان.",
    type: "website",
    locale: "fa_IR",
    siteName: "Homeino",
  },
};

export const viewport: Viewport = {
  themeColor: "#F0E8D8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-ivory text-ink antialiased">
        <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
