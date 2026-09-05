import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd, storeJsonLd, jsonLdScript } from "@/lib/seo";
import { getStore } from "@/data/stores";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = getStore(slug);
  if (!store) return { title: "فروشگاه یافت نشد" };
  return {
    title: `فروشگاه ${store.name} — محصولات و نظرات`,
    description: store.description.slice(0, 155),
    alternates: { canonical: `/stores/${store.slug}` },
    openGraph: { title: `${store.name} | Homeino`, description: store.description, type: "website", locale: "fa_IR", images: [{ url: store.cover }] },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = getStore(slug);
  if (!store) return children;

  const structuredData = [
    breadcrumbJsonLd([
      { name: "خانه", url: "/" },
      { name: "فروشگاه‌ها", url: "/stores" },
      { name: store.name, url: `/stores/${store.slug}` },
    ]),
    storeJsonLd({
      name: store.name,
      slug: store.slug,
      description: store.description,
      city: store.city,
      rating: store.rating,
      reviewsCount: store.reviewsCount,
      cover: store.cover,
    }),
  ];

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
