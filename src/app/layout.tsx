import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SITE_URL, SITE } from "@/config/site";
import { organizationJsonLd, websiteJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Homeino | خانه‌ ایی که شبیه توست، همین‌جا آغاز می‌شود",
    template: "%s | Homeino",
  },
  description:
    "سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز — Homeino: بازارگاه خانه، دکوراسیون، مقایسه فروشگاه‌ها و طراحی هوشمند با هومینو استودیو.",
  keywords: [
    "خرید مبلمان",
    "بازارگاه دکوراسیون",
    "دکوراسیون",
    "طراحی داخلی",
    "فروشگاه خانه",
    "طراحی هوشمند",
    "مقایسه فروشگاه",
    "سبک طراحی داخلی",
    "خانه رویایی",
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
    title: "Homeino | خانه‌ ایی که شبیه توست، همین‌جا آغاز می‌شود",
    description: "سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز — خانه، دکوراسیون، مقایسه فروشگاه و طراحی هوشمند.",
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    url: SITE_URL,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Homeino | خانه‌ ایی که شبیه توست، همین‌جا آغاز می‌شود",
    description: "سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز — بازارگاه خانه و دکوراسیون Homeino.",
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
  // Third-party analytics are env-gated: unset → zero scripts, zero network,
  // zero cost. Sample mode stays fully functional without them.
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* SEO: fast, reliable path to the stock imagery used across the storefront. */}
        <link rel="preconnect" href="https://images.pexels.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />
      </head>
      <body className="bg-ivory text-ink antialiased">
        <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
        <AppShell>{children}</AppShell>
        {GA_ID ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        ) : null}
        {METRIKA_ID ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};k=e.createElement(t),k.async=1,k.src=r,a=e.getElementsByTagName(t)[0],a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${METRIKA_ID},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`,
            }}
          />
        ) : null}
        {/* Site-wide structured data — Organization + WebSite w/ SearchAction */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: jsonLdScript([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
      </body>
    </html>
  );
}
