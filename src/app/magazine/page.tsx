// ============================================================
// /magazine — SERVER page (Task 33 refactor).
//
// Was "use client" (so it could not export metadata). Now:
//   • per-page metadata + canonical `/magazine`
//   • CollectionPage JSON-LD listing the articles
//   • server-rendered shell (header) — the only client island
//     is <MagazineBrowser> (category filter)
// ============================================================
import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/shared";
import { MagazineBrowser } from "@/components/magazine/MagazineBrowser";
import { articles } from "@/data/content";
import { SITE_URL } from "@/config/site";
import { jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "مجله هومینو — الهام و راهنمای خانه",
  description:
    "راهنمای خرید، سبک‌شناسی، نورپردازی و ترندهای دکوراسیون — مقالات عمیق و همیشگی مجله هومینو برای ساختن خانه‌ای بهتر.",
  alternates: { canonical: "/magazine" },
  openGraph: {
    title: "مجله هومینو — الهام و راهنمای خانه",
    description: "راهنمای خرید، سبک‌شناسی، نورپردازی و ترندهای دکوراسیون برای ساختن خانه‌ای بهتر.",
    type: "website",
    locale: "fa_IR",
    url: `${SITE_URL}/magazine`,
    siteName: "Homeino",
  },
};

export default function MagazinePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "مجله هومینو — الهام و راهنمای خانه",
    url: `${SITE_URL}/magazine`,
    hasPart: articles.slice(0, 20).map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.excerpt,
      url: `${SITE_URL}/magazine/${a.slug}`,
      datePublished: a.date,
      author: { "@type": "Person", name: a.author },
    })),
  };

  return (
    <Container className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <PageHeader eyebrow="مجله Homeino" title="الهام و راهنمای خانه" desc="راهنمای خرید، سبک‌ها، نورپردازی و ترندهای دکوراسیون — برای ساختن خانه‌ای بهتر." />
      <MagazineBrowser articles={articles} />
    </Container>
  );
}
