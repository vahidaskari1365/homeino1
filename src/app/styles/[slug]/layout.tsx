import type { Metadata } from "next";
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

export default function StyleLayout({ children }: { children: React.ReactNode }) { return children; }
