import type { Metadata } from "next";
import type { ReactNode } from "react";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { getArticle } from "@/data/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "مقاله یافت نشد" };
  return {
    title: article.title,
    description: article.excerpt.slice(0, 155),
    alternates: { canonical: `/magazine/${article.slug}` },
    openGraph: { title: article.title, description: article.excerpt, type: "article", locale: "fa_IR", publishedTime: article.date, authors: [article.author], images: [{ url: article.cover }] },
    twitter: { card: "summary_large_image", title: article.title, description: article.excerpt, images: [article.cover] },
  };
}

export default async function MagazineLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return children;

  const structuredData = [
    breadcrumbJsonLd([
      { name: "خانه", url: "/" },
      { name: "مجله", url: "/magazine" },
      { name: article.title, url: `/magazine/${article.slug}` },
    ]),
    articleJsonLd({
      title: article.title,
      excerpt: article.excerpt,
      author: article.author,
      date: article.date,
      cover: article.cover,
      slug: article.slug,
    }),
  ];

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
