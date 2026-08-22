import type { Metadata } from "next";
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

export default function MagazineLayout({ children }: { children: React.ReactNode }) { return children; }
