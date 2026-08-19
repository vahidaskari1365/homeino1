"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin, Package, Star, Clock, Users, ShoppingBag, Truck, RotateCcw, ShieldCheck, Award, CalendarDays,
} from "lucide-react";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { Button, LogoBlock, Rating, Chip, VerifiedBadge } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getStore } from "@/data/stores";
import { productsByStore } from "@/data/products";
import { categories } from "@/data/categories";
import { sampleReviews } from "@/data/inspirations";
import { useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";

export default function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const store = getStore(slug);
  if (!store) notFound();

  const products = productsByStore(store!.id);
  const [sort, setSort] = useState<"all" | "trending" | "discount">("all");
  const wl = useWishlist(); const { toast } = useUi();
  const wished = wl.stores.includes(store!.id);
  const list = products.filter((p) => sort === "all" ? true : sort === "trending" ? p.trending : p.oldPrice);

  const storeCategories = store!.categorySlugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter(Boolean);

  // Deterministic rating distribution (sample — backend will provide real values).
  const fiveStar = Math.round((store!.rating - 3) * 50);
  const dist = [fiveStar, 100 - fiveStar - 4, 3, 1, 0];

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "فروشگاه‌ها", href: "/stores" }, { label: store!.name }]} />

      {/* ---- Store identity: banner + logo + verification ---- */}
      <Reveal>
        <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
          <SmartImage src={store!.cover} alt={store!.name} className="h-48 w-full sm:h-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-ink/20" />
        </div>
        <div className="relative -mt-12 flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="card-surface p-2"><LogoBlock char={store!.logo} color={store!.logoColor} size={72} /></div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-black text-ink">{store!.name}</h1>
                {store!.verified ? <VerifiedBadge className="px-2.5 py-1 text-[11px]" /> : <span className="inline-flex items-center gap-1 rounded-full border border-clay/45 bg-ivory-2 px-2.5 py-1 text-[11px] font-bold text-ink-muted">در حال احراز هویت</span>}
                {store!.badges.slice(0, 2).map((badge) => <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-[#80601f]"><Award size={12} /> {badge}</span>)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                <span className="flex items-center gap-1"><MapPin size={13} /> {store!.city}</span>
                <span className="flex items-center gap-1"><Package size={13} /> {toFa(store!.productCount)} محصول</span>
                <span className="flex items-center gap-1"><Star size={13} className="fill-gold text-gold" /> {toFa(store!.rating.toFixed(1))} ({toFa(store!.reviewsCount)})</span>
                <span className="flex items-center gap-1"><CalendarDays size={13} /> فعالیت از {toFa(store!.sinceYear)}</span>
              </div>
            </div>
          </div>
          <Button variant={wished ? "primary" : "outline"} onClick={() => { wl.toggleStore(store!.id); toast(wished ? "از دنبال‌شده‌ها حذف شد" : "فروشگاه دنبال شد"); }} className="mb-2">
            {wished ? "دنبال می‌کنی ✓" : "دنبال کردن فروشگاه"}
          </Button>
        </div>
      </Reveal>

      {/* ---- Trust strip: sales, followers, response time ---- */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [ShoppingBag, `${toFa(store!.salesCount)}`, "فروش موفق"],
          [Users, `${toFa(store!.followersCount)}`, "دنبال‌کننده"],
          [Clock, store!.responseTime, "زمان پاسخگویی"],
          [ShieldCheck, "تضمین Homeino", "اصالت و بازگشت"],
        ].map(([Icon, value, label]) => {
          const I = Icon as typeof Truck;
          return (
            <div key={label as string} className="card-surface flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand/45 text-terracotta-deep"><I size={19} /></span>
              <div className="min-w-0">
                <div className="text-sm font-black text-ink">{value as string}</div>
                <div className="text-[11px] text-ink-muted">{label as string}</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 max-w-2xl leading-8 text-ink-muted">{store!.description}</p>

      {/* ---- Categories this store sells ---- */}
      {storeCategories.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-muted">دسته‌بندی‌ها:</span>
          {storeCategories.map((c) => c && (
            <Link key={c.slug} href={`/category/${c.slug}`} className="rounded-full border border-clay/55 bg-cream px-3 py-1.5 text-xs font-medium text-ink transition hover:border-terracotta hover:text-terracotta-deep">
              {c.name} <span className="text-ink-muted/70">({toFa(c.productCount)})</span>
            </Link>
          ))}
        </div>
      )}

      {/* ---- Products with sort ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black text-ink">محصولات این فروشگاه</h2>
        <div className="flex flex-wrap gap-2">
          {[["all", "همه"], ["trending", "محبوب‌ها"], ["discount", "تخفیف‌دار"]].map(([k, l]) => (
            <Chip key={k} active={sort === k} onClick={() => setSort(k as typeof sort)}>{l}</Chip>
          ))}
        </div>
      </div>
      <div className="mt-5"><ProductGrid products={list} /></div>

      {/* ---- Policies: shipping, return, secure payment ---- */}
      <div className="mt-12">
        <h2 className="mb-4 font-display text-xl font-black text-ink">ارسال، بازگشت و پرداخت</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="card-surface p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink"><Truck size={18} className="text-terracotta-deep" /> ارسال</div>
            <p className="text-xs leading-6 text-ink-muted">{store!.shippingPolicy}</p>
          </div>
          <div className="card-surface p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink"><RotateCcw size={18} className="text-terracotta-deep" /> بازگشت</div>
            <p className="text-xs leading-6 text-ink-muted">{store!.returnPolicy}</p>
          </div>
          <div className="card-surface p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink"><ShieldCheck size={18} className="text-terracotta-deep" /> پرداخت امن</div>
            <p className="text-xs leading-6 text-ink-muted">پرداخت از طریق درگاه امن Homeino انجام می‌شود و تا تحویل کالا نزد Homeino امانت می‌ماند{store!.verified ? "؛ این فروشگاه احراز هویت شده است." : "؛ این فروشگاه هنوز احراز هویت کامل نشده است."}</p>
          </div>
        </div>
      </div>

      {/* ---- Reviews ---- */}
      <div className="mt-12">
        <h2 className="mb-4 font-display text-xl font-black text-ink">نظرات خریداران</h2>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="card-surface p-6 text-center">
            <div className="font-display text-5xl font-black text-ink">{toFa(store!.rating.toFixed(1))}</div>
            <div className="mt-1 flex justify-center"><Rating value={store!.rating} /></div>
            <div className="mt-1 text-xs text-ink-muted">از {toFa(store!.reviewsCount)} نظر</div>
            <div className="mt-4 space-y-1.5 text-right">
              {dist.map((pct, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-ink-muted">
                  <span className="w-3 shrink-0">{toFa(5 - i)}</span>
                  <Star size={10} className="shrink-0 fill-gold text-gold" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ivory-2"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
                  <span className="w-6 text-left">{toFa(pct)}٪</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {sampleReviews.map((r) => (
              <div key={r.id} className="card-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><LogoBlock char={r.author[0]} color="#6b6358" size={36} /><div><div className="text-sm font-medium text-ink">{r.author}</div><div className="text-xs text-ink-muted">{r.date}</div></div></div>
                  <Rating value={r.rating} />
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-muted">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
