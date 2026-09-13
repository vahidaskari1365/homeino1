import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container, Breadcrumb, PageHeader } from "@/components/shared";
import { CategoryProducts } from "./CategoryProducts";
import { SmartImage } from "@/components/ui/SmartImage";
import { categories, getCategory } from "@/data/categories";
import { productsByCategory } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { toFa } from "@/lib/utils";
import { TREND_CATEGORY_META } from "@/lib/trends";
import { InspirationCard } from "@/components/cards";

/**
 * SERVER category page — previously the whole page was "use client", so every
 * category shipped the generic site title and pulled the entire catalog
 * module into the client bundle. Now:
 *   • generateStaticParams → every category is pre-rendered static HTML
 *   • generateMetadata → unique title/description/canonical/OG per category
 *     (the single highest-leverage SEO fix: these are the "خرید فرش"-class
 *     money pages)
 *   • only the filter chips + product grid remain a client island
 *     (see CategoryProducts.tsx)
 */
export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "دسته یافت نشد", robots: { index: false } };

  const count = productsByCategory(category.slug).length;
  const title = `خرید ${category.name} — قیمت و انواع ${category.name} | هومینو`;
  const description = `${category.description ?? `خرید آنلاین ${category.name} از فروشگاه‌های معتبر ایران.`} بیش از ${toFa(count)} مدل ${category.name} با مقایسه قیمت، فیلتر سبک و رنگ و ارسال به سراسر کشور.`.slice(0, 300);

  return {
    title,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fa_IR",
      url: `/category/${category.slug}`,
      images: [{ url: category.image, width: 1200, height: 630, alt: category.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [category.image] },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const products = productsByCategory(category.slug);
  const relatedInspirations = inspirations
    .filter((item) => item.tags.some((tag) => category.name.includes(tag) || category.nameEn.toLowerCase().includes(tag)))
    .slice(0, 3);

  // دسته‌ی محصول ↔ هاب ترند (کلستر سئو)
  const trendMeta = TREND_CATEGORY_META.find((m) => m.productSlug === category.slug);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "دسته‌بندی‌ها", href: "/products" }, { label: category.name }]} />

      <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
        <SmartImage src={category.image} alt={category.name} className="h-48 w-full sm:h-64" priority />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 to-ink/30" />
        <div className="absolute inset-0 flex flex-col justify-center p-8 text-cream">
          <h1 className="font-display text-3xl font-black sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-md text-cream/75">{category.description}</p>
          <div className="mt-3 text-sm text-cream/60">{toFa(products.length)} محصول · {toFa(category.subcategories.length)} زیردسته</div>
        </div>
      </div>

      <CategoryProducts
        category={category}
        products={products}
        relatedCategories={categories
          .filter((item) => item.slug !== category.slug)
          .slice(0, 6)
          .map((item) => ({ slug: item.slug, name: item.name }))}
      />

      {/* کلستر سئو: صفحه دسته‌ی محصول ↔ هاب ترند همان دسته */}
      {trendMeta && (
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/30 bg-gold/8 p-6">
          <div>
            <h2 className="font-display text-lg font-black text-ink">ترندهای {trendMeta.label} را دنبال کنید</h2>
            <p className="mt-1 max-w-xl text-sm leading-7 text-ink-muted">
              هر روز تازه‌ترین ترندهای جهانی {trendMeta.label} را از معتبرترین منابع دیزاین جمع می‌کنیم و به فارسیِ مستقل بازنویسی می‌کنیم — با نسخه کاربردی برای خانه ایرانی.
            </p>
          </div>
          <Link href={`/trends/category/${trendMeta.slug}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-terracotta-deep">
            مشاهده ترندهای {category.name} <ArrowLeft size={15} />
          </Link>
        </div>
      )}

      {relatedInspirations.length > 0 && (
        <div className="mt-14">
          <PageHeader title="الهام از این دسته" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {relatedInspirations.map((inspiration) => <InspirationCard key={inspiration.id} insp={inspiration} />)}
          </div>
        </div>
      )}
    </Container>
  );
}
