"use client";
import { useMemo, useState } from "react";
import { BadgeCheck, Search, SlidersHorizontal, SearchX, X } from "lucide-react";
import { Container, PageHeader, ProductGrid, FilterGroup } from "@/components/shared";
import { Chip, Button, EmptyState, Drawer, SelectField } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import { categories } from "@/data/categories";
import { toFa } from "@/lib/utils";

const SORTS = [["popular", "پرفروش‌ترین"], ["rating", "بالاترین امتیاز"], ["newest", "جدیدترین"], ["price-asc", "ارزان‌ترین"], ["price-desc", "گران‌ترین"], ["discount", "بیشترین تخفیف"]] as const;

export default function ProductsPage() {
  const [cats, setCats] = useState<string[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyStock, setOnlyStock] = useState(true);
  const [maxPrice, setMaxPrice] = useState(70000000);
  const [sort, setSort] = useState<string>("popular");
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
      if (query.trim() && !`${p.name} ${p.brand} ${p.tags.join(" ")}`.includes(query.trim())) return false;
      if (onlyDiscount && !p.oldPrice) return false;
      if (onlyVerified && !stores.find((store) => store.id === p.storeId)?.verified) return false;
      if (onlyStock && !p.inStock) return false;
      if (p.price > maxPrice) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "popular") return b.purchaseCount - a.purchaseCount;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "newest") return Number(b.isNew) - Number(a.isNew);
      if (sort === "discount") return ((b.oldPrice ?? b.price) - b.price) / (b.oldPrice ?? b.price) - ((a.oldPrice ?? a.price) - a.price) / (a.oldPrice ?? a.price);
      return 0;
    });
    return list;
  }, [cats, storeIds, styleIds, colors, query, onlyDiscount, onlyVerified, onlyStock, maxPrice, sort]);

  const activeCount = cats.length + storeIds.length + styleIds.length + colors.length + (query.trim() ? 1 : 0) + (onlyDiscount ? 1 : 0) + (onlyVerified ? 1 : 0) + (onlyStock ? 1 : 0);
  const resetFilters = () => { setCats([]); setStoreIds([]); setStyleIds([]); setColors([]); setQuery(""); setOnlyDiscount(false); setOnlyVerified(false); setOnlyStock(true); setMaxPrice(70000000); };

  const Filters = (
    <div>
      <FilterGroup title="دسته‌بندی" options={categories.map((category) => category.name)} selected={categories.filter((category) => cats.includes(category.slug)).map((category) => category.name)} onToggle={(value) => { const slug = categories.find((category) => category.name === value)?.slug; if (slug) toggle(cats, slug, setCats); }} />
      <FilterGroup title="فروشگاه" options={stores.map((store) => store.name)} selected={stores.filter((store) => storeIds.includes(store.id)).map((store) => store.name)} onToggle={(value) => { const id = stores.find((store) => store.name === value)?.id; if (id) toggle(storeIds, id, setStoreIds); }} />
      <FilterGroup title="سبک" options={styles.map((item) => item.name)} selected={styles.filter((item) => styleIds.includes(item.slug)).map((item) => item.name)} onToggle={(value) => { const slug = styles.find((item) => item.name === value)?.slug; if (slug) toggle(styleIds, slug, setStyleIds); }} />
      <FilterGroup title="رنگ" options={colorOpts} selected={colors} onToggle={(value) => toggle(colors, value, setColors)} />
      <div className="border-b border-clay/40 py-4">
        <h4 className="mb-3 text-sm font-bold text-ink">بازه قیمت</h4>
        <input type="range" min={500000} max={70000000} step={500000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-terracotta" />
        <div className="mt-2 text-xs text-ink-muted">تا {toFa(Math.round(maxPrice / 1000000).toLocaleString("en-US"))} میلیون تومان</div>
      </div>
      <div className="space-y-2 border-b border-clay/40 py-4 text-sm">
        {[["فقط کالاهای موجود", onlyStock, setOnlyStock], ["فقط فروشگاه تأییدشده", onlyVerified, setOnlyVerified], ["فقط تخفیف‌دارها", onlyDiscount, setOnlyDiscount]].map(([label, val, set]) => (
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
      <PageHeader eyebrow="بازارگاه چندفروشگاهی" title="کشف محصولات خانه" desc="جستجو، فیلتر و مقایسه کن؛ قیمت و فروشنده هر انتخاب از ابتدا روشن است." />

      <div className="mb-5 flex min-h-14 items-center gap-3 rounded-2xl border border-clay/40 bg-cream px-4 shadow-[var(--shadow-soft)]">
        <Search size={19} className="shrink-0 text-ink-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در نام محصول، برند یا کاربرد…" className="min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:shadow-none" />
        {query && <button type="button" onClick={() => setQuery("")} className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-ivory-2" aria-label="پاک کردن جستجو"><X size={16} /></button>}
      </div>

      <div className="hide-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {categories.map((category) => <Chip key={category.slug} active={cats.includes(category.slug)} onClick={() => toggle(cats, category.slug, setCats)}>{category.name}</Chip>)}
      </div>

      <div className="mt-6 flex gap-6">
        {/* sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 card-surface p-5">{Filters}</div>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><button onClick={() => setShowFilters(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clay/60 px-4 text-sm text-ink lg:hidden"><SlidersHorizontal size={16} /> فیلترها {activeCount > 0 && <span className="rounded-full bg-terracotta px-1.5 text-[10px] text-white">{toFa(activeCount)}</span>}</button><p className="text-sm text-ink-muted">{toFa(filtered.length)} محصول</p>{onlyVerified && <span className="hidden items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] text-success sm:inline-flex"><BadgeCheck size={11} /> فروشگاه تأییدشده</span>}{activeCount > 1 && <button type="button" onClick={resetFilters} className="text-xs font-bold text-terracotta-deep">پاک‌کردن فیلترها</button>}</div>
            <SelectField aria-label="مرتب‌سازی محصولات" value={sort} onChange={(event) => setSort(event.target.value)} options={SORTS.map(([value, label]) => ({ value, label }))} className="min-w-36" />
          </div>

          {filtered.length > 0 ? (
            <ProductGrid products={filtered} />
          ) : (
            <EmptyState icon={<SearchX size={28} />} title="محصولی با این فیلترها پیدا نشد" desc="فیلترها را تغییر بده یا بازنشانی کن." action={<Button variant="ghost" onClick={resetFilters}>بازنشانی فیلترها</Button>} />
          )}
        </div>
      </div>

      <Drawer open={showFilters} onClose={() => setShowFilters(false)} title="فیلتر محصولات" footer={<Button className="w-full" onClick={() => setShowFilters(false)}>مشاهده {toFa(filtered.length)} محصول</Button>}>
        {Filters}
      </Drawer>
    </Container>
  );
}
