"use client";
import { useSearchParams } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { Suspense, useMemo } from "react";
import { Container, ProductGrid, PageHeader } from "@/components/shared";
import { EmptyState, Button } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import { categories } from "@/data/categories";
import { StoreCard } from "@/components/cards";
import { toFa } from "@/lib/utils";
import Link from "next/link";

const TRENDING = ["کاناپه مدرن", "ژاپندی", "آینه طاقی", "ست کوسن"];

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const term = q.trim();

  const results = useMemo(() => {
    if (!term) return { products: [], stores: [], styles: [], cats: [] };
    const match = (t: string) => t.includes(term);
    return {
      products: products.filter((p) => p.name.includes(term) || p.brand.includes(term) || p.tags.some(match) || p.styleSlugs.some((s) => styles.find((x) => x.slug === s)?.name.includes(term))),
      stores: stores.filter((s) => s.name.includes(term)),
      styles: styles.filter((s) => s.name.includes(term)),
      cats: categories.filter((c) => c.name.includes(term)),
    };
  }, [term]);

  const total = results.products.length + results.stores.length + results.styles.length + results.cats.length;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="جستجو" title={term ? `نتایج برای «${term}»` : "جستجو در Homeino"} desc={term ? `${toFa(total)} نتیجه پیدا شد` : "محصول، فروشگاه، سبک یا ایده موردنظرت را پیدا کن."} />

      <form action="/search" method="get" className="card-surface mb-8 flex min-w-0 items-center gap-2 p-2 sm:mx-auto sm:max-w-2xl">
        <Search size={19} className="mr-2 shrink-0 text-ink-muted" />
        <input name="q" defaultValue={term} placeholder="مثلاً مبل کرم برای پذیرایی کوچک…" className="min-w-0 flex-1 border-0 bg-transparent px-1 text-sm focus:shadow-none sm:text-base" />
        <Button type="submit" className="shrink-0"><Search size={16} /><span className="hidden sm:inline">جستجو</span></Button>
      </form>

      {!term ? (
        <EmptyState icon={<SearchX size={28} />} title="عبارتی برای جستجو وارد کن" desc="مثلاً: مبل کرم برای پذیرایی کوچک" />
      ) : total === 0 ? (
        <EmptyState icon={<SearchX size={28} />} title="نتیجه‌ای پیدا نشد" desc="با کلمات دیگری امتحان کن." action={<div className="flex flex-wrap justify-center gap-2">{TRENDING.map((text) => <Link key={text} href={`/search?q=${encodeURIComponent(text)}`} className="min-h-10 rounded-full border border-clay/55 bg-cream px-4 py-2 text-sm text-ink hover:border-terracotta">{text}</Link>)}</div>} />
      ) : (
        <div className="space-y-10">
          {results.styles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.styles.map((style) => <Link key={style.slug} href={`/styles/${style.slug}`} className="min-h-10 rounded-full border border-ink bg-ink px-4 py-2 text-sm font-bold text-cream">{style.name}</Link>)}
            </div>
          )}
          {results.stores.length > 0 && (
            <div>
              <h3 className="mb-4 font-display text-lg font-bold text-ink">فروشگاه‌ها</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {results.stores.map((s) => <StoreCard key={s.id} store={s} />)}
              </div>
            </div>
          )}
          {results.products.length > 0 && (
            <div>
              <h3 className="mb-4 font-display text-lg font-bold text-ink">محصولات ({toFa(results.products.length)})</h3>
              <ProductGrid products={results.products} />
            </div>
          )}
        </div>
      )}
    </Container>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Container className="py-20"><ProductGrid products={[]} loading /></Container>}>
      <SearchInner />
    </Suspense>
  );
}
