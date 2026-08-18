"use client";
import { useMemo, useState } from "react";
import { SlidersHorizontal, LayoutGrid, List, X, SearchX } from "lucide-react";
import { Container, PageHeader, ProductGrid, FilterGroup } from "@/components/shared";
import { Chip, Button, EmptyState } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import { categories } from "@/data/categories";
import { toFa } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SORTS = [["newest", "جدیدترین"], ["price-asc", "ارزان‌ترین"], ["price-desc", "گران‌ترین"], ["rating", "محبوب‌ترین"], ["discount", "بیشترین تخفیف"]] as const;

export default function ProductsPage() {
  const [cats, setCats] = useState<string[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyAi, setOnlyAi] = useState(false);
  const [onlyStock, setOnlyStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState(70000000);
  const [sort, setSort] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const colorOpts = Array.from(new Set(products.flatMap((p) => p.colors.map((c) => c.name)))).slice(0, 8);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (cats.length && !cats.includes(p.categorySlug)) return false;
      if (storeIds.length && !storeIds.includes(p.storeId)) return false;
      if (styleIds.length && !p.styleSlugs.some((s) => styleIds.includes(s))) return false;
      if (colors.length && !p.colors.some((c) => colors.includes(c.name))) return false;
      if (onlyDiscount && !p.oldPrice) return false;
      if (onlyAi && !p.aiRecommended) return false;
      if (onlyStock && !p.inStock) return false;
      if (p.price > maxPrice) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "discount") return (b.oldPrice ? 1 : 0) - (a.oldPrice ? 1 : 0);
      return 0;
    });
    return list;
  }, [cats, storeIds, styleIds, colors, onlyDiscount, onlyAi, onlyStock, maxPrice, sort]);

  const activeCount = cats.length + storeIds.length + styleIds.length + colors.length + (onlyDiscount ? 1 : 0) + (onlyAi ? 1 : 0) + (onlyStock ? 1 : 0);

  const Filters = (
    <div>
      <FilterGroup title="دسته‌بندی" options={categories.map((c) => c.name)} selected={cats.map((n) => categories.find((c) => c.name === n)?.slug ?? n)} onToggle={(v) => toggle(cats, v, setCats)} />
      <FilterGroup title="سبک" options={styles.map((s) => s.name)} selected={styleIds} onToggle={(v) => toggle(styleIds, v, setStyleIds)} />
      <FilterGroup title="رنگ" options={colorOpts} selected={colors} onToggle={(v) => toggle(colors, v, setColors)} />
      <div className="border-b border-clay/40 py-4">
        <h4 className="mb-3 text-sm font-bold text-ink">بازه قیمت</h4>
        <input type="range" min={500000} max={70000000} step={500000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-terracotta" />
        <div className="mt-2 text-xs text-ink-muted">تا {toFa(Math.round(maxPrice / 1000000).toLocaleString("en-US"))} میلیون تومان</div>
      </div>
      <div className="space-y-2 border-b border-clay/40 py-4 text-sm">
        {[["فقط تخفیف‌دارها", onlyDiscount, setOnlyDiscount], ["پیشنهاد AI", onlyAi, setOnlyAi], ["فقط موجودها", onlyStock, setOnlyStock]].map(([label, val, set]) => (
          <label key={label as string} className="flex cursor-pointer items-center justify-between text-ink-muted">
            <span>{label as string}</span>
            <input type="checkbox" checked={val as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} className="h-4 w-4 rounded accent-terracotta" />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Container className="py-10">
      <PageHeader eyebrow="بازارگاه" title="همه محصولات" desc={`${toFa(products.length)} محصول از ${toFa(stores.length)} فروشگاه`} />

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => <Chip key={c.slug} active={cats.includes(c.slug)} onClick={() => toggle(cats, c.slug, setCats)}>{c.name}</Chip>)}
      </div>

      <div className="mt-6 flex gap-6">
        {/* sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 card-surface p-5">{Filters}</div>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-2 rounded-xl border border-clay/60 px-4 py-2 text-sm text-ink lg:hidden">
              <SlidersHorizontal size={16} /> فیلترها {activeCount > 0 && <span className="rounded-full bg-terracotta px-1.5 text-[10px] text-white">{toFa(activeCount)}</span>}
            </button>
            <p className="hidden text-sm text-ink-muted lg:block">{toFa(filtered.length)} محصول</p>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-clay/60 bg-cream px-3 py-2 text-sm text-ink outline-none">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {filtered.length > 0 ? (
            <ProductGrid products={filtered} />
          ) : (
            <EmptyState icon={<SearchX size={28} />} title="محصولی با این فیلترها پیدا نشد" desc="فیلترها را تغییر بده یا بازنشانی کن." action={<Button variant="ghost" onClick={() => { setCats([]); setStoreIds([]); setStyleIds([]); setColors([]); setOnlyDiscount(false); setOnlyAi(false); setOnlyStock(false); setMaxPrice(70000000); }}>بازنشانی فیلترها</Button>} />
          )}
        </div>
      </div>

      {/* mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] bg-ink/50 lg:hidden" onClick={() => setShowFilters(false)}>
          <div className="absolute bottom-0 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">فیلترها</h3>
              <button onClick={() => setShowFilters(false)} aria-label="بستن فیلترها" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><X size={20} /></button>
            </div>
            <FilterGroup title="فروشگاه" options={stores.map((s) => s.name)} selected={storeIds} onToggle={(v) => toggle(storeIds, v, setStoreIds)} />
            {Filters}
            <Button className="mt-5 w-full" onClick={() => setShowFilters(false)}>مشاهده {toFa(filtered.length)} محصول</Button>
          </div>
        </div>
      )}
    </Container>
  );
}
