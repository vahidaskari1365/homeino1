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
    "Homeino — مرجع خرید مبلمان، دکوراسیون و طراحی داخلی. الهام بگیر، محصولات را مقایسه کن، از فروشگاه‌های معتبر خرید کن و با هوش مصنوعی خانه‌ات را طراحی کن.",
  keywords: ["خرید مبلمان", "دکوراسیون", "طراحی داخلی", "اسباب خانه", "لوازم خانگی", "Homeino"],
  openGraph: {
    title: "Homeino",
    description: "الهام، محصول، فروشگاه و طراحی با هوش مصنوعی — همه در یک مکان.",
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
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
      </head>
      <body className="bg-ivory text-ink antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
