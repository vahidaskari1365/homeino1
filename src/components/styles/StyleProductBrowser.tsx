"use client";

import { useMemo, useState } from "react";
import { SearchX, Shapes } from "lucide-react";
import type { Product } from "@/types";
import { categories } from "@/data/categories";
import { ProductGrid } from "@/components/shared";
import { EmptyState } from "@/components/ui/primitives";
import { cn, toFa } from "@/lib/utils";

interface StyleProductBrowserProps {
  /** Products pre-filtered by the style of the page. */
  products: Product[];
  styleName: string;
}

interface StyleCategoryOption {
  slug: string;
  name: string;
  count: number;
}

/**
 * On-page product browser for a style page.
 *
 * Products arrive already narrowed to the page's style; the visitor can then
 * combine that style with the site's own categories via quick chips. The full
 * marketplace filters (price, color, material, ...) stay one click away in
 * /products?style=... — this component intentionally keeps only category
 * filtering to stay light inside the editorial style guide.
 */
export function StyleProductBrowser({ products, styleName }: StyleProductBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoryOptions = useMemo<StyleCategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
    }
    return categories
      .filter((category) => counts.has(category.slug))
      .map((category) => ({ slug: category.slug, name: category.name, count: counts.get(category.slug) ?? 0 }));
  }, [products]);

  const filtered = activeCategory
    ? products.filter((product) => product.categorySlug === activeCategory)
    : products;

  if (!products.length) return null;

  return (
    <div>
      <div className="mb-5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-terracotta-deep"><Shapes size={14} /> خرید بر اساس همین سبک</p>
        <h2 className="mt-2 text-2xl font-black text-ink">محصولات با سبک {styleName}</h2>
        <p className="mt-1 text-sm text-ink-muted">محصولات مرتب‌شده بر اساس سبک {styleName} — برای دقیق‌تر شدن، روی دسته‌بندی مورد نظرت بزن.</p>
      </div>

      {categoryOptions.length > 0 && (
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1" aria-label="فیلتر دسته‌بندی محصولات این سبک">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-4 text-sm transition",
              activeCategory === null ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink",
            )}
          >
            همه دسته‌ها
          </button>
          {categoryOptions.map((option) => (
            <button
              type="button"
              key={option.slug}
              onClick={() => setActiveCategory(option.slug === activeCategory ? null : option.slug)}
              aria-pressed={option.slug === activeCategory}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-4 text-sm transition",
                option.slug === activeCategory ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink",
              )}
            >
              {option.name} <span className={cn("text-[10px]", option.slug === activeCategory ? "text-cream/70" : "text-ink-muted/70")}>{toFa(option.count)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="mb-4 text-sm text-ink-muted" aria-live="polite">{toFa(filtered.length)} محصول</p>

      {filtered.length > 0 ? (
        <ProductGrid products={filtered} cols={4} />
      ) : (
        <EmptyState
          icon={<SearchX size={28} />}
          title="محصولی در این دسته‌بندی نیست"
          desc={`از دسته‌های دیگر برای سبک ${styleName} دیدن کن یا همه دسته‌ها را نمایش بده.`}
        />
      )}
    </div>
  );
}
