import type { Metadata } from "next";
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

export default function InspirationLayout({ children }: { children: React.ReactNode }) { return children; }
