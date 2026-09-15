"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, RotateCcw, SearchX, SlidersHorizontal, X } from "lucide-react";
import type { Product } from "@/types";
import { categories } from "@/data/categories";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import {
  PRODUCT_FILTER_QUERY_KEYS,
  filterProducts,
  parseProductFilters,
  productPriceCeiling,
  type AvailabilityFilter,
} from "@/lib/productFilters";
import { cn, formatPrice, toFa } from "@/lib/utils";
import { ProductGrid } from "@/components/shared";
import { Button, EmptyState } from "@/components/ui/primitives";

type GridColumns = 3 | 4;
type FilterLayout = "full" | "compact";

interface FilterableProductGridProps {
  products: Product[];
  cols?: GridColumns;
  layout?: FilterLayout;
  showStoreFilter?: boolean;
  showMarketplaceFilters?: boolean;
  quickCategories?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

interface FacetOption {
  value: string;
  label: string;
  count?: number;
  href?: string;
}

// Static name lookups for the active-filter chips — built ONCE at module
// level instead of three `new Map(...)` allocations on every render
// (rules: hoist static work / rerender-memo-with-default-value).
const STYLE_NAME = new Map(styles.map((style) => [style.slug, style.name]));
const CATEGORY_NAME = new Map(categories.map((category) => [category.slug, category.name]));
const STORE_NAME = new Map(stores.map((store) => [store.id, store.name]));

const SORTS = [
  ["newest", "جدیدترین"],
  ["price-asc", "ارزان‌ترین"],
  ["price-desc", "گران‌ترین"],
  ["rating", "محبوب‌ترین"],
  ["discount", "بیشترین تخفیف"],
] as const;

function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  action,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  action?: React.ReactNode;
}) {
  if (!options.length) return null;

  return (
    <fieldset className="border-b border-clay/40 py-4">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {action}
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto pl-1">
        {options.map((option) => (
          <div key={option.value} className="flex min-h-7 items-center justify-between gap-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-ink-muted transition hover:text-ink">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 shrink-0 rounded border-clay accent-terracotta"
              />
              <span className="truncate">{option.label}</span>
              {option.count != null && <span className="mr-auto text-2xs text-ink-muted/70">{toFa(option.count)}</span>}
            </label>
            {option.href && (
              <Link
                href={option.href}
                aria-label={`معرفی ${option.label}`}
                title={`معرفی ${option.label}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-ivory-2 hover:text-terracotta-deep"
              >
                <BookOpen size={13} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function FilterableProductGridInner({
  products,
  cols = 4,
  layout = "full",
  showStoreFilter = false,
  showMarketplaceFilters = false,
  quickCategories = false,
  emptyTitle = "محصولی با این فیلترها پیدا نشد",
  emptyDescription = "یک یا چند فیلتر را حذف کن و دوباره ببین.",
  className,
}: FilterableProductGridProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [draftPrice, setDraftPrice] = useState<number | null>(null);

  const filters = useMemo(() => parseProductFilters(searchParams), [searchParams]);
  const filtered = useMemo(() => filterProducts(products, filters), [products, filters]);
  const priceCeiling = useMemo(() => productPriceCeiling(products), [products]);
  const displayedPrice = draftPrice ?? Math.min(filters.priceMax ?? priceCeiling, priceCeiling);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    // URLSearchParams escapes commas; retaining them makes multi-select links
    // readable/shareable while every individual value remains safely encoded.
    const query = next.toString().replace(/%2C/gi, ",");
    const href = `${pathname}${query ? `?${query}` : ""}`;
    const current = `${pathname}${searchParams.size ? `?${searchParams.toString().replace(/%2C/gi, ",")}` : ""}`;
    if (href !== current) router.push(href, { scroll: false });
  };

  const setCsv = (key: string, values: string[]) => {
    navigate((params) => {
      if (values.length) params.set(key, values.join(","));
      else params.delete(key);
    });
  };

  const toggleCsv = (key: string, selected: string[], value: string) => {
    setCsv(key, selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const setSingle = (key: string, value?: string) => {
    navigate((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  };

  const reset = () => {
    setDraftPrice(null);
    navigate((params) => PRODUCT_FILTER_QUERY_KEYS.forEach((key) => params.delete(key)));
  };

  const commitPrice = () => {
    if (draftPrice == null) return;
    setSingle("priceMax", draftPrice < priceCeiling ? String(draftPrice) : undefined);
    setDraftPrice(null);
  };

  // Facet counts in ONE pass over the catalog (rules: js-combine-iterations +
  // js-index-maps). Previously every facet option re-filtered the whole list
  // (~60 full-catalog passes per render, re-running on every slider tick);
  // now a single pass builds count maps + name sets and every lookup is O(1).
  const facets = useMemo(() => {
    const style = new Map<string, number>();
    const category = new Map<string, number>();
    const color = new Map<string, number>();
    const material = new Map<string, number>();
    const store = new Map<string, number>();
    const colorNames = new Set<string>();
    const materialNames = new Set<string>();
    let inStock = 0;
    let outOfStock = 0;

    for (const product of products) {
      for (const slug of product.styleSlugs) style.set(slug, (style.get(slug) ?? 0) + 1);
      category.set(product.categorySlug, (category.get(product.categorySlug) ?? 0) + 1);
      for (const item of product.colors) {
        colorNames.add(item.name);
        color.set(item.name, (color.get(item.name) ?? 0) + 1);
      }
      for (const materialName of product.materials) {
        materialNames.add(materialName);
        material.set(materialName, (material.get(materialName) ?? 0) + 1);
      }
      store.set(product.storeId, (store.get(product.storeId) ?? 0) + 1);
      if (product.inStock) inStock += 1;
      else outOfStock += 1;
    }

    return {
      style,
      category,
      color,
      material,
      store,
      inStock,
      outOfStock,
      colorNames: Array.from(colorNames),
      materialNames: Array.from(materialNames),
    };
  }, [products]);

  const styleOptions = styles
    .map((style) => ({
      value: style.slug,
      label: style.name,
      count: facets.style.get(style.slug) ?? 0,
      href: `/styles/${style.slug}`,
    }))
    .filter((option) => option.count > 0 || filters.styles.includes(option.value));

  const categoryOptions = categories
    .map((category) => ({
      value: category.slug,
      label: category.name,
      count: facets.category.get(category.slug) ?? 0,
    }))
    .filter((option) => option.count > 0 || filters.categories.includes(option.value));

  const colorOptions = facets.colorNames.map((color) => ({
    value: color,
    label: color,
    count: facets.color.get(color) ?? 0,
  }));

  const materialOptions = facets.materialNames
    .sort((a, b) => a.localeCompare(b, "fa"))
    .map((material) => ({
      value: material,
      label: material,
      count: facets.material.get(material) ?? 0,
    }));

  const storeOptions = stores
    .map((store) => ({
      value: store.id,
      label: store.name,
      count: facets.store.get(store.id) ?? 0,
    }))
    .filter((option) => option.count > 0 || filters.stores.includes(option.value));

  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...filters.styles.map((style) => ({
      key: `style-${style}`,
      label: `سبک: ${STYLE_NAME.get(style) ?? style}`,
      remove: () => setCsv("style", filters.styles.filter((item) => item !== style)),
    })),
    ...filters.categories.map((category) => ({
      key: `category-${category}`,
      label: `دسته: ${CATEGORY_NAME.get(category) ?? category}`,
      remove: () => setCsv("category", filters.categories.filter((item) => item !== category)),
    })),
    ...filters.colors.map((color) => ({
      key: `color-${color}`,
      label: `رنگ: ${color}`,
      remove: () => setCsv("color", filters.colors.filter((item) => item !== color)),
    })),
    ...filters.materials.map((material) => ({
      key: `material-${material}`,
      label: `متریال: ${material}`,
      remove: () => setCsv("material", filters.materials.filter((item) => item !== material)),
    })),
    ...filters.stores.map((store) => ({
      key: `store-${store}`,
      label: `فروشگاه: ${STORE_NAME.get(store) ?? store}`,
      remove: () => setCsv("store", filters.stores.filter((item) => item !== store)),
    })),
    ...(filters.availability
      ? [{
          key: "availability",
          label: `موجودی: ${filters.availability === "in-stock" ? "فقط موجود" : "ناموجود"}`,
          remove: () => setSingle("availability"),
        }]
      : []),
    ...(filters.priceMax != null
      ? [{
          key: "priceMax",
          label: `تا ${toFa(formatPrice(filters.priceMax))} تومان`,
          remove: () => setSingle("priceMax"),
        }]
      : []),
    ...(filters.onlyDiscount
      ? [{ key: "discount", label: "فقط تخفیف‌دار", remove: () => setSingle("discount") }]
      : []),
    ...(filters.onlyAiRecommended
      ? [{ key: "ai", label: "پیشنهاد هومینو استودیو", remove: () => setSingle("ai") }]
      : []),
  ];

  const availabilityOptions: FacetOption[] = [
    { value: "in-stock", label: "فقط کالاهای موجود", count: facets.inStock },
    { value: "out-of-stock", label: "کالاهای ناموجود", count: facets.outOfStock },
  ];

  const filtersPanel = (
    <div>
      <FacetGroup
        title="سبک"
        options={styleOptions}
        selected={filters.styles}
        onToggle={(value) => toggleCsv("style", filters.styles, value)}
        action={<Link href="/styles" className="inline-flex items-center gap-1 text-2xs font-bold text-terracotta-deep hover:underline"><BookOpen size={12} /> معرفی سبک‌ها</Link>}
      />
      {categoryOptions.length > 1 || filters.categories.length ? (
        <FacetGroup title="دسته‌بندی" options={categoryOptions} selected={filters.categories} onToggle={(value) => toggleCsv("category", filters.categories, value)} />
      ) : null}
      <FacetGroup title="رنگ" options={colorOptions} selected={filters.colors} onToggle={(value) => toggleCsv("color", filters.colors, value)} />
      <FacetGroup title="متریال" options={materialOptions} selected={filters.materials} onToggle={(value) => toggleCsv("material", filters.materials, value)} />
      {showStoreFilter && storeOptions.length > 1 && (
        <FacetGroup title="فروشگاه" options={storeOptions} selected={filters.stores} onToggle={(value) => toggleCsv("store", filters.stores, value)} />
      )}
      <FacetGroup
        title="موجودی"
        options={availabilityOptions}
        selected={filters.availability ? [filters.availability] : []}
        onToggle={(value) => setSingle("availability", filters.availability === value ? undefined : value as AvailabilityFilter)}
      />
      <div className="border-b border-clay/40 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">بازه قیمت</h4>
          {filters.priceMax != null && <button type="button" onClick={() => setSingle("priceMax")} className="text-2xs text-terracotta-deep hover:underline">بدون محدودیت</button>}
        </div>
        <input
          aria-label="حداکثر قیمت"
          type="range"
          min={500_000}
          max={priceCeiling}
          step={500_000}
          value={displayedPrice}
          onChange={(event) => setDraftPrice(Number(event.target.value))}
          onPointerUp={commitPrice}
          onKeyUp={commitPrice}
          onBlur={commitPrice}
          className="w-full accent-terracotta"
        />
        <div className="mt-2 text-xs text-ink-muted">تا {toFa(formatPrice(displayedPrice))} تومان</div>
      </div>
      {showMarketplaceFilters && (
        <div className="space-y-2 border-b border-clay/40 py-4 text-sm">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-ink-muted">
            <span>فقط تخفیف‌دارها</span>
            <input type="checkbox" checked={filters.onlyDiscount} onChange={(event) => setSingle("discount", event.target.checked ? "true" : undefined)} className="h-4 w-4 rounded accent-terracotta" />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-ink-muted">
            <span>پیشنهاد هومینو استودیو</span>
            <input type="checkbox" checked={filters.onlyAiRecommended} onChange={(event) => setSingle("ai", event.target.checked ? "true" : undefined)} className="h-4 w-4 rounded accent-terracotta" />
          </label>
        </div>
      )}
      {activeChips.length > 0 && (
        <button type="button" onClick={reset} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-clay/60 text-xs font-bold text-ink-muted transition hover:border-ink hover:text-ink">
          <RotateCcw size={14} /> بازنشانی همه فیلترها
        </button>
      )}
    </div>
  );

  const activeFiltersPanel = activeChips.length > 0 ? (
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
      {activeChips.map((chip) => (
        <button
          type="button"
          key={chip.key}
          onClick={chip.remove}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/8 px-3 text-xs font-bold text-terracotta-deep transition hover:bg-terracotta/15"
          aria-label={`حذف فیلتر ${chip.label}`}
        >
          {chip.label} <X size={13} />
        </button>
      ))}
      {filters.styles.length > 0 && (
        <Link
          href={filters.styles.length === 1 ? `/styles/${filters.styles[0]}` : "/styles"}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted transition hover:bg-ivory-2 hover:text-ink"
        >
          <BookOpen size={13} /> درباره {filters.styles.length === 1 ? `سبک ${STYLE_NAME.get(filters.styles[0])}` : "این سبک‌ها"}
        </Link>
      )}
      <button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1 px-2 text-xs text-ink-muted hover:text-danger"><RotateCcw size={12} /> پاک‌کردن همه</button>
    </div>
  ) : null;

  const renderToolbar = (mobileOnlyButton = false) => (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowFilters((open) => !open)}
          className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl border border-clay/60 bg-cream px-4 text-sm text-ink", mobileOnlyButton && "lg:hidden")}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={16} /> فیلترها
          {activeChips.length > 0 && <span className="rounded-full bg-terracotta px-1.5 text-2xs text-white">{toFa(activeChips.length)}</span>}
        </button>
        <p className={cn("text-sm text-ink-muted", mobileOnlyButton && "hidden lg:block")} aria-live="polite">{toFa(filtered.length)} محصول</p>
      </div>
      <select
        aria-label="مرتب‌سازی محصولات"
        value={filters.sort}
        onChange={(event) => setSingle("sort", event.target.value === "newest" ? undefined : event.target.value)}
        className="min-h-10 rounded-xl border border-clay/60 bg-cream px-3 text-sm text-ink outline-none"
      >
        {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
  );

  const gridResult = filtered.length > 0 ? (
    <ProductGrid products={filtered} cols={cols} />
  ) : (
    <EmptyState
      icon={<SearchX size={28} />}
      title={emptyTitle}
      desc={emptyDescription}
      action={<Button variant="ghost" onClick={reset}><RotateCcw size={15} /> بازنشانی فیلترها</Button>}
    />
  );

  if (layout === "compact") {
    return (
      <section className={className} aria-label="فیلتر و فهرست محصولات">
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          <Link href="/styles" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/8 px-3 text-xs font-bold text-ink"><BookOpen size={13} className="text-gold" /> معرفی سبک‌ها</Link>
          {styleOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => toggleCsv("style", filters.styles, option.value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 text-xs transition",
                filters.styles.includes(option.value) ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {renderToolbar()}
        {showFilters && <div className="card-surface mb-5 grid gap-x-6 px-5 sm:grid-cols-2 lg:grid-cols-3">{filtersPanel}</div>}
        {activeFiltersPanel}
        {gridResult}
      </section>
    );
  }

  return (
    <section className={className} aria-label="فیلتر و فهرست محصولات">
      {quickCategories && categoryOptions.length > 1 && (
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1" aria-label="دسته‌بندی سریع">
          <button type="button" onClick={() => setCsv("category", [])} className={cn("min-h-9 shrink-0 rounded-full border px-4 text-sm transition", filters.categories.length === 0 ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink")}>همه</button>
          {categoryOptions.map((option) => (
            <button type="button" key={option.value} onClick={() => toggleCsv("category", filters.categories, option.value)} className={cn("min-h-9 shrink-0 rounded-full border px-4 text-sm transition", filters.categories.includes(option.value) ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink")}>{option.label}</button>
          ))}
        </div>
      )}
      {activeFiltersPanel}
      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="card-surface sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">{filtersPanel}</div>
        </aside>
        <div className="min-w-0 flex-1">
          {renderToolbar(true)}
          {gridResult}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-[100] bg-ink/50 lg:hidden" onClick={() => setShowFilters(false)}>
          <div className="absolute bottom-0 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div><h3 className="font-display text-lg font-bold text-ink">فیلتر محصولات</h3><p className="mt-0.5 text-xs text-ink-muted">{toFa(filtered.length)} نتیجه</p></div>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="بستن فیلترها" className="grid h-10 w-10 place-items-center rounded-lg transition hover:bg-ivory-2"><X size={20} /></button>
            </div>
            {filtersPanel}
            <Button className="mt-5 w-full" onClick={() => setShowFilters(false)}>مشاهده {toFa(filtered.length)} محصول</Button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Suspense is kept at the component boundary so every route can safely use URL
 * search params without opting the whole page into client-side rendering.
 */
export function FilterableProductGrid(props: FilterableProductGridProps) {
  return (
    <Suspense fallback={<ProductGrid products={[]} loading cols={props.cols} />}>
      <FilterableProductGridInner {...props} />
    </Suspense>
  );
}
