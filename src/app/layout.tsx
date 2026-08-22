import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SITE_URL, SITE } from "@/config/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Homeino | هر آنچه برای خانه‌ی رویایی‌ات لازم داری",
    template: "%s | Homeino",
  },
  description:
    "Homeino — پلتفرم جامع خانه و بازارگاه چندفروشگاهی دکوراسیون. الهام بگیر، محصولات و فروشگاه‌ها را کشف و مقایسه کن و با اطمینان خرید کن.",
  keywords: [
    "خرید مبلمان",
    "بازارگاه دکوراسیون",
    "دکوراسیون",
    "طراحی داخلی",
    "فروشگاه خانه",
    "طراحی هوشمند",
    "Homeino",
  ],
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE_URL }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: { email: false, telephone: false, address: false },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Homeino | بازارگاه خانه و دکوراسیون",
    description: "الهام، محصول، فروشگاه، مقایسه و خرید مطمئن — همه در یک مکان.",
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    url: SITE_URL,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Homeino | بازارگاه خانه و دکوراسیون",
    description: "الهام، محصول، فروشگاه، مقایسه و خرید مطمئن — همه در یک مکان.",
    images: [SITE.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#F0E8D8",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-ivory text-ink antialiased">
        <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
        <AppShell>{children}</AppShell>
        {/* Site-wide structured data — Organization + WebSite w/ SearchAction */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
      </body>
    </html>
  );
}
