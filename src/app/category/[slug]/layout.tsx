import type { Metadata } from "next";
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

export default function CategoryLayout({ children }: { children: React.ReactNode }) { return children; }
