"use client";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { Suspense, useMemo } from "react";
import { Container, ProductGrid, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { EmptyState, Chip } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import { categories } from "@/data/categories";
import { StoreCard } from "@/components/cards";
import { toFa, faIncludes } from "@/lib/utils";
import Link from "next/link";

const TRENDING = ["کاناپه مدرن", "ژاپندی", "آینه طاقی", "ست کوسن"];

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const term = q.trim();

  const results = useMemo(() => {
    if (!term) return { products: [], stores: [], styles: [], cats: [] };
    const match = (t: string) => faIncludes(t, term);
    return {
      products: products.filter((p) => faIncludes(p.name, term) || faIncludes(p.brand, term) || p.tags.some(match) || p.styleSlugs.some((s) => styles.find((x) => x.slug === s)?.name && faIncludes(styles.find((x) => x.slug === s)!.name, term))),
      stores: stores.filter((s) => faIncludes(s.name, term)),
      styles: styles.filter((s) => faIncludes(s.name, term)),
      cats: categories.filter((c) => faIncludes(c.name, term)),
    };
  }, [term]);

  const total = results.products.length + results.stores.length + results.styles.length + results.cats.length;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="جستجو" title={term ? `نتایج برای «${term}»` : "جستجو در Homeino"} desc={term ? `${toFa(total)} نتیجه پیدا شد` : "هر چیزی دنبالش هستی اینجا پیدا کن."} />

      {!term ? (
        <EmptyState icon={<SearchX size={28} />} title="عبارتی برای جستجو وارد کن" desc="مثلاً: مبل کرم برای پذیرایی کوچک" />
      ) : total === 0 ? (
        <EmptyState icon={<SearchX size={28} />} title="نتیجه‌ای پیدا نشد" desc="با کلمات دیگری امتحان کن." action={<div className="flex flex-wrap justify-center gap-2">{TRENDING.map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`}><Chip>{t}</Chip></Link>)}</div>} />
      ) : (
        <div className="space-y-10">
          {results.styles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.styles.map((s) => <Link key={s.slug} href={`/styles/${s.slug}`}><Chip active>{s.name}</Chip></Link>)}
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
              <FilterableProductGrid
                products={results.products}
                layout="compact"
                emptyDescription="فیلتر سبک یا سایر فیلترهای نتایج جستجو را تغییر بده."
              />
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
