import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd } from "@/lib/seo";
import { getCategory } from "@/data/categories";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) return { title: "دسته‌بندی یافت نشد" };
  return {
    title: `خرید ${cat.name} — بهترین قیمت و کیفیت`,
    description: cat.description?.slice(0, 155) || `خرید آنلاین ${cat.name} با بهترین قیمت از فروشگاه‌های معتبر Homeino`,
    alternates: { canonical: `/category/${cat.slug}` },
    openGraph: { title: `${cat.name} | Homeino`, description: cat.description, type: "website", locale: "fa_IR", images: [{ url: cat.image }] },
  };
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return children;

  const structuredData = breadcrumbJsonLd([
    { name: "خانه", url: "/" },
    { name: "دسته‌بندی‌ها", url: "/products" },
    { name: category.name, url: `/category/${category.slug}` },
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
