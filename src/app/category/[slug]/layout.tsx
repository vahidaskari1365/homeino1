import type { Metadata } from "next";
import { getCategory } from "@/data/categories";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) return { title: "دسته‌بندی یافت نشد" };
  return {
    title: `خرید ${cat.name} — مقایسه محصولات و فروشگاه‌ها`,
    description: cat.description?.slice(0, 155) || `محصولات ${cat.name} را از فروشگاه‌های مختلف Homeino کشف و مقایسه کنید.`,
    alternates: { canonical: `/category/${cat.slug}` },
    openGraph: { title: `${cat.name} | Homeino`, description: cat.description, type: "website", locale: "fa_IR", images: [{ url: cat.image }] },
  };
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) { return children; }
