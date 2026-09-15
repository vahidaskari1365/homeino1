"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ProductGrid } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import type { Category, Product } from "@/types";

export interface RelatedCategoryChip {
  slug: string;
  name: string;
}

/**
 * Client island for the category page — the only interactive slice.
 * The page shell (hero, breadcrumb, trend box, inspirations) is a server
 * component now: unique per-category metadata + static HTML for crawlers,
 * and only THIS category's products ship to the browser (previously the
 * whole catalog module was pulled into the client bundle).
 */
function CategoryProductsInner({
  category,
  products,
  relatedCategories,
}: {
  category: Category;
  products: Product[];
  relatedCategories: RelatedCategoryChip[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedSub = searchParams.get("sub");
  const sub = category.subcategories.some((item) => item.slug === requestedSub) ? requestedSub : null;
  const visibleProducts = sub ? products.filter((product) => product.subCategorySlug === sub) : products;

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
        <Link href={subHref(null)} scroll={false} aria-current={!sub ? "true" : undefined} className={`min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${!sub ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink"}`}>همه</Link>
        {category.subcategories.map((item) => (
          <Link key={item.id} href={subHref(item.slug)} scroll={false} aria-current={sub === item.slug ? "true" : undefined} className={`min-h-9 shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${sub === item.slug ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink"}`}>{item.name}</Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {relatedCategories.map((item) => (
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

export function CategoryProducts({
  category,
  products,
  relatedCategories,
}: {
  category: Category;
  products: Product[];
  relatedCategories: RelatedCategoryChip[];
}) {
  return (
    <Suspense fallback={<div className="mt-8"><ProductGrid products={[]} loading /></div>}>
      <CategoryProductsInner category={category} products={products} relatedCategories={relatedCategories} />
    </Suspense>
  );
}
