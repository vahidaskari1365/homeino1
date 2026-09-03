import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getStyle } from "@/data/styles";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const style = getStyle(slug);
  if (!style) return { title: "سبک یافت نشد" };
  return {
    title: `سبک ${style.name} در دکوراسیون — ایده و محصولات`,
    description: style.description.slice(0, 155),
    alternates: { canonical: `/styles/${style.slug}` },
    openGraph: { title: `سبک ${style.name} | Homeino`, description: style.description, type: "website", locale: "fa_IR", images: [{ url: style.image }] },
  };
}

export default async function StyleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const style = getStyle(slug);
  if (!style) return children;

  const structuredData = breadcrumbJsonLd([
    { name: "خانه", url: "/" },
    { name: "سبک‌ها", url: "/styles" },
    { name: style.name, url: `/styles/${style.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
