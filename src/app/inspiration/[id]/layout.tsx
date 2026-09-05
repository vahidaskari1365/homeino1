import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { getInspiration } from "@/data/inspirations";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const insp = getInspiration(id);
  if (!insp) return { title: "ایده یافت نشد" };
  return {
    title: `${insp.title} — ایده دکوراسیون`,
    description: `ایده دکوراسیون ${insp.room} با سبک ${insp.styleSlug}. الهام بگیر و محصولات مشابه را در Homeino پیدا کن.`,
    alternates: { canonical: `/inspiration/${insp.id}` },
    openGraph: { title: insp.title, type: "website", locale: "fa_IR", images: [{ url: insp.image }] },
  };
}

export default async function InspirationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspiration = getInspiration(id);
  if (!inspiration) return children;

  const structuredData = breadcrumbJsonLd([
    { name: "خانه", url: "/" },
    { name: "الهام", url: "/inspiration" },
    { name: inspiration.title, url: `/inspiration/${inspiration.id}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }}
      />
      {children}
    </>
  );
}
