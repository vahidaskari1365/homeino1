"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, TrendingUp, Clock, ArrowLeft } from "lucide-react";
import { useUi } from "@/stores/useApp";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { cn, toFa } from "@/lib/utils";
import { SmartImage } from "../ui/SmartImage";
import { Rating } from "../ui/primitives";
import { formatPrice } from "@/lib/utils";

const RECENT = ["مبل کرم پذیرایی", "چراغ رومیزی چوبی", "فرش دستبافت"];
const TRENDING = ["کاناپه مدرن", "ژاپندی", "آینه طاقی", "ست کوسن خاکی", "لوکس"];

export function SearchOverlay() {
  const { searchOpen, setSearch } = useUi();
  const router = useRouter();
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearch(false);
    if (searchOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearch]);

  useEffect(() => {
    document.body.style.overflow = searchOpen ? "hidden" : "";
  }, [searchOpen]);

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const term = q.trim();
    const match = (t: string) => t.includes(term);
    return {
      products: products.filter((p) => p.name.includes(term) || p.brand.includes(term) || p.tags.some(match)).slice(0, 4),
      stores: stores.filter((s) => s.name.includes(term)).slice(0, 3),
      categories: categories.filter((c) => c.name.includes(term)).slice(0, 3),
      styles: styles.filter((s) => s.name.includes(term)).slice(0, 3),
    };
  }, [q]);

  if (!searchOpen) return null;

  const go = (path: string) => { setSearch(false); setQ(""); router.push(path); };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink/40 backdrop-blur-sm" onClick={() => setSearch(false)}>
      <div className="mx-auto mt-0 w-full max-w-3xl animate-[fadeUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-cream shadow-[var(--shadow-lift)]">
          {/* input */}
          <div className="flex items-center gap-3 border-b border-clay/40 px-5 py-4">
            <Search size={22} className="text-ink-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && q.trim() && go(`/search?q=${encodeURIComponent(q.trim())}`)}
              placeholder="مثلاً: مبل کرم برای پذیرایی کوچک…"
              className="flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink-muted/60"
            />
            <button onClick={() => setSearch(false)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-ivory-2" aria-label="بستن">
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-5">
            {!results && (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-muted"><TrendingUp size={14} /> جستجوی پرطرفدار</div>
                  <div className="flex flex-wrap gap-2">
                    {TRENDING.map((t) => (
                      <button key={t} onClick={() => go(`/search?q=${encodeURIComponent(t)}`)} className="rounded-full border border-clay/60 px-3.5 py-1.5 text-sm text-ink transition hover:border-ink hover:bg-ivory-2">{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-muted"><Clock size={14} /> جستجوهای اخیر</div>
                  <div className="space-y-1">
                    {RECENT.map((r) => (
                      <button key={r} onClick={() => setQ(r)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-ink transition hover:bg-ivory-2">
                        <span>{r}</span><ArrowLeft size={15} className="text-ink-muted" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {categories.slice(0, 4).map((c) => (
                    <button key={c.id} onClick={() => go(`/category/${c.slug}`)} className="rounded-xl border border-clay/40 bg-ivory-2 p-3 text-right transition hover:border-ink">
                      <div className="text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-muted">{toFa(c.productCount)} محصول</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-5">
                {results.products.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-ink-muted">محصولات</div>
                    <div className="space-y-1">
                      {results.products.map((p) => (
                        <button key={p.id} onClick={() => go(`/products/${p.slug}`)} className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition hover:bg-ivory-2">
                          <SmartImage src={p.images[0]} alt={p.name} className="h-12 w-12 shrink-0 rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                            <div className="flex items-center gap-2 text-xs text-ink-muted"><Rating value={p.rating} size={11} /> · {formatPrice(p.price)} تومان</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(results.stores.length > 0 || results.styles.length > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {results.stores.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-semibold text-ink-muted">فروشگاه‌ها</div>
                        {results.stores.map((s) => (
                          <button key={s.id} onClick={() => go(`/stores/${s.slug}`)} className="block w-full rounded-lg px-2 py-1.5 text-right text-sm text-ink transition hover:bg-ivory-2">{s.name}</button>
                        ))}
                      </div>
                    )}
                    {results.styles.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-semibold text-ink-muted">سبک‌ها</div>
                        {results.styles.map((s) => (
                          <button key={s.slug} onClick={() => go(`/styles/${s.slug}`)} className="block w-full rounded-lg px-2 py-1.5 text-right text-sm text-ink transition hover:bg-ivory-2">{s.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {results.products.length === 0 && results.stores.length === 0 && (
                  <div className="py-8 text-center text-ink-muted">
                    <p className="text-sm">نتیجه‌ای پیدا نشد. با کلمات دیگری امتحان کن.</p>
                    <button onClick={() => go(`/search?q=${encodeURIComponent(q)}`)} className="mt-3 text-sm font-medium text-terracotta-deep">مشاهده همه نتایج جستجو →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
