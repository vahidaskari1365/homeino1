"use client";

import Link from "next/link";
import { Suspense, use } from "react";
import { notFound, usePathname, useSearchParams } from "next/navigation";
import { Container, Breadcrumb, PageHeader, ProductGrid } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCategory, categories } from "@/data/categories";
import { productsByCategory } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { toFa } from "@/lib/utils";
import { InspirationCard } from "@/components/cards";
import type { Category } from "@/types";

function CategoryProducts({ category }: { category: Category }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedSub = searchParams.get("sub");
  const sub = category.subcategories.some((item) => item.slug === requestedSub) ? requestedSub : null;
  const allProducts = productsByCategory(category.slug);
  const visibleProducts = sub ? allProducts.filter((product) => product.subCategorySlug === sub) : allProducts;

  const subHref = (value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("sub", value);
    else next.delete("sub");
    const query = next.toString().replace(/%2C/gi, ",");
    return `${pathname}${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1" aria-label="زیردسته‌ها">
        <Link href={subHref(null)} scroll={false} className={`min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${!sub ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink"}`}>همه</Link>
        {category.subcategories.map((item) => (
          <Link key={item.id} href={subHref(item.slug)} scroll={false} className={`min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${sub === item.slug ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink"}`}>{item.name}</Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.filter((item) => item.slug !== category.slug).slice(0, 6).map((item) => (
          <Link key={item.slug} href={`/category/${item.slug}`} className="rounded-full border border-clay/50 px-3 py-1 text-xs text-ink-muted transition hover:border-ink hover:text-ink">{item.name}</Link>
        ))}
      </div>

      <FilterableProductGrid
        products={visibleProducts}
        className="mt-8"
        emptyDescription="سبک یا سایر فیلترها را تغییر بده، یا زیردسته‌ی دیگری انتخاب کن."
      />
    </>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const category = getCategory(slug);
  if (!category) notFound();

  const relatedInspirations = inspirations
    .filter((item) => item.tags.some((tag) => category.name.includes(tag) || category.nameEn.toLowerCase().includes(tag)))
    .slice(0, 3);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "دسته‌بندی‌ها", href: "/products" }, { label: category.name }]} />

      <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
        <SmartImage src={category.image} alt={category.name} className="h-48 w-full sm:h-64" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 to-ink/30" />
        <div className="absolute inset-0 flex flex-col justify-center p-8 text-cream">
          <h1 className="font-display text-3xl font-black sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-md text-cream/75">{category.description}</p>
          <div className="mt-3 text-sm text-cream/60">{toFa(productsByCategory(category.slug).length)} محصول · {toFa(category.subcategories.length)} زیردسته</div>
        </div>
      </div>

      <Suspense fallback={<div className="mt-8"><ProductGrid products={[]} loading /></div>}>
        <CategoryProducts category={category} />
      </Suspense>

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
