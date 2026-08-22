import type { Metadata } from "next";
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

export default function StoreLayout({ children }: { children: React.ReactNode }) { return children; }
