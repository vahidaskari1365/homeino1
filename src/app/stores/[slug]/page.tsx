import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getStorePageData } from "@/services/storefront";
import { StoreDetailView } from "./StoreDetailView";

// ============================================================
// /stores/[slug] — صفحهٔ فروشگاه روی دیتابیس واقعی (Task 60)
//
// «اول اتصال /stores/[slug] به دیتابیس» — منبع حقیقت همان DB است:
// فروشگاه فعال + کالاهای فعال + نظرات تأییدشده از سرور می‌آیند و
// فروشگاه‌های تازه‌تأییدِ بک‌اند بلافاصله صفحهٔ عمومی دارند.
// بدون DB یا برای فروشگاه‌های نمونهٔ محلی، همان کاتالوگ دمو (صادقانه).
// ISR ۶۰ ثانیه: صفحهٔ فروشگاه جدید تا یک دقیقه بعد از تأیید آماده است.
// ============================================================

const getPageData = cache(getStorePageData);

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPageData(slug);
  if (!data) return { title: "فروشگاه یافت نشد | هومینو" };
  const { store } = data;
  const description =
    store.description?.slice(0, 160) || `خرید از فروشگاه ${store.name} در هومینو`;
  return {
    title: `${store.name} | فروشگاه‌های هومینو`,
    description,
    openGraph: {
      title: store.name,
      description,
      images: store.cover ? [store.cover] : undefined,
    },
  };
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPageData(slug);
  if (!data) notFound();
  return <StoreDetailView data={data} />;
}
