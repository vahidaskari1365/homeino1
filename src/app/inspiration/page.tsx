// ============================================================
// /inspiration — SERVER page (Task 33 refactor).
//
// Was "use client" (so it could not export metadata). Now:
//   • per-page metadata + canonical `/inspiration`
//   • CollectionPage JSON-LD listing the newest pins
//   • server-rendered shell (header); `getAllInspirations()`
//     runs at build time (pure JSON merge — no fs, no APIs)
// The only client island is <InspirationBrowser> (filters +
// upload modal), fed with the serialisable pin feed.
// ============================================================
import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/shared";
import { InspirationBrowser } from "@/components/inspiration/InspirationBrowser";
import { getAllInspirations } from "@/data/inspirations";
import { SITE_URL } from "@/config/site";
import { jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "گالری الهام چیدمان خانه — پین‌های واقعی دکوراسیون",
  description:
    "هر روز پین‌های تازه‌ی چیدمان و دکوراسیون از سردبیر هومینو و کاربران؛ به‌دلیل سبک و فضا بگرد، ذخیره کن و محصولات همان چیدمان را مستقیم بخر.",
  alternates: { canonical: "/inspiration" },
  openGraph: {
    title: "گالری الهام چیدمان خانه — هومینو",
    description: "هر روز پین‌های تازه‌ی چیدمان و دکوراسیون؛ بگرد، ذخیره کن، بخر.",
    type: "website",
    locale: "fa_IR",
    url: `${SITE_URL}/inspiration`,
    siteName: "Homeino",
  },
};

export default function InspirationPage() {
  const pins = getAllInspirations();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "گالری الهام چیدمان خانه — هومینو",
    url: `${SITE_URL}/inspiration`,
    hasPart: pins.slice(0, 24).map((p) => ({
      "@type": "ImageObject",
      name: p.title,
      contentUrl: p.image,
      url: `${SITE_URL}/inspiration/${p.id}`,
    })),
  };

  return (
    <Container className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <PageHeader
        eyebrow="الهام"
        title="پین‌های الهام‌بخش چیدمان"
        desc="هر روز پین‌های تازه از سردبیر هومینو و کاربران؛ بگرد، ذخیره کن و عکس خانه‌ات را هم با بقیه به اشتراک بگذار."
      />
      <InspirationBrowser pins={pins} />
    </Container>
  );
}
