"use client";

import Link from "next/link";
import { Heart, GitCompare, ShoppingBag, MapPin, BadgeCheck } from "lucide-react";
import type { Product, Store, InspirationImage } from "@/types";
import { useWishlist, useCompare, useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { cn, toFa } from "@/lib/utils";
import { SmartImage } from "./ui/SmartImage";
import { Badge, Price, Rating, LogoBlock } from "./ui/primitives";

export function ProductCard({ product }: { product: Product }) {
  const wishlist = useWishlist();
  const compare = useCompare();
  const addToCart = useCart((state) => state.add);
  const toast = useUi((state) => state.toast);
  const wished = wishlist.products.includes(product.id);
  const compared = compare.has(product.id);

  return (
    <article className="group card-surface card-interactive flex min-w-0 flex-col overflow-hidden">
      <div className="relative overflow-hidden bg-ivory-2">
        <Link href={`/products/${product.slug}`} aria-label={`مشاهده ${product.name}`} className="block aspect-[4/5] overflow-hidden">
          <SmartImage src={product.images[0]} alt={product.name} className="h-full w-full transition-transform duration-700 group-hover:scale-[1.025]" />
        </Link>
        <div className="absolute right-2 top-2 z-10 flex max-w-[70%] flex-col items-start gap-1">
          {product.discount ? <Badge tone="accent">{product.discount}٪ تخفیف</Badge> : null}
          {product.isNew && <Badge tone="dark">جدید</Badge>}
          {product.aiRecommended && <Badge tone="gold">پیشنهاد AI</Badge>}
        </div>
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5">
          <button type="button" aria-label={wished ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"} aria-pressed={wished} onClick={() => { wishlist.toggleProduct(product.id); toast(wished ? "از علاقه‌مندی حذف شد" : "به علاقه‌مندی اضافه شد"); }} className={cn("grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink/62 text-cream shadow-sm backdrop-blur transition hover:bg-ink active:scale-90", wished && "bg-cream text-terracotta-deep")}>
            <Heart size={16} className={cn(wished && "fill-current")} />
          </button>
          <button type="button" aria-label={compared ? "حذف از مقایسه" : "افزودن به مقایسه"} aria-pressed={compared} onClick={() => { compare.toggle(product.id); toast(compared ? "از مقایسه حذف شد" : "به مقایسه اضافه شد"); }} className={cn("grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink/62 text-cream shadow-sm backdrop-blur transition hover:bg-ink active:scale-90", compared && "bg-gold text-ink")}>
            <GitCompare size={15} />
          </button>
        </div>
        {!product.inStock && <div className="absolute inset-x-2 bottom-2 rounded-lg bg-ink/78 px-2 py-1.5 text-center text-[10px] font-bold text-cream backdrop-blur">فعلاً ناموجود</div>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold text-terracotta-deep sm:text-xs">{product.brand}</span>
          <Rating value={product.rating} size={12} />
        </div>
        <Link href={`/products/${product.slug}`} className="mt-1.5 line-clamp-2 min-h-10 text-xs font-black leading-5 text-ink transition hover:text-terracotta-deep sm:text-sm sm:leading-6">{product.name}</Link>
        <Price price={product.price} oldPrice={product.oldPrice} className="mt-2 [&_span:first-child]:text-sm sm:[&_span:first-child]:text-base" />
        <button type="button" disabled={!product.inStock} onClick={() => { addToCart(product.id); toast("به سبد خرید اضافه شد"); }} className="btn-primary mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-bold disabled:opacity-40 sm:text-xs">
          <ShoppingBag size={14} /><span className="hidden min-[360px]:inline">افزودن به سبد</span><span className="min-[360px]:hidden">افزودن</span>
        </button>
      </div>
    </article>
  );
}

export function StoreCard({ store }: { store: Store }) {
  const wishlist = useWishlist();
  const wished = wishlist.stores.includes(store.id);
  const toast = useUi((state) => state.toast);

  return (
    <article className="group card-surface card-interactive relative overflow-hidden">
      <Link href={`/stores/${store.slug}`} className="block" aria-label={`مشاهده فروشگاه ${store.name}`}>
        <div className="relative h-32 overflow-hidden">
          <SmartImage src={store.cover} alt={`ویترین ${store.name}`} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
          {store.verified && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-cream/92 px-2 py-1 text-[10px] font-bold text-ink backdrop-blur"><BadgeCheck size={13} className="text-success" /> تأیید شده</span>}
          {store.isNew && <span className="absolute left-3 top-3"><Badge tone="accent">جدید</Badge></span>}
        </div>
      </Link>
      <div className="px-4 pb-4">
        <div className="-mt-7 mb-2 flex items-end justify-between">
          <Link href={`/stores/${store.slug}`} className="relative rounded-2xl border-4 border-cream"><LogoBlock char={store.logo} color={store.logoColor} size={56} /></Link>
          <button type="button" onClick={() => { wishlist.toggleStore(store.id); toast(wished ? "دنبال‌کردن فروشگاه لغو شد" : "فروشگاه را دنبال می‌کنی"); }} aria-label={wished ? "لغو دنبال‌کردن فروشگاه" : "دنبال‌کردن فروشگاه"} aria-pressed={wished} className={cn("mb-1 grid h-10 w-10 place-items-center rounded-full border border-clay/40 bg-cream text-ink-muted shadow-sm transition hover:border-terracotta hover:text-terracotta-deep", wished && "border-terracotta/30 bg-terracotta/10 text-terracotta-deep")}>
            <Heart size={16} className={cn(wished && "fill-current")} />
          </button>
        </div>
        <Link href={`/stores/${store.slug}`}><h3 className="text-base font-black text-ink transition group-hover:text-terracotta-deep">{store.name}</h3></Link>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-ink-muted">{store.description}</p>
        {store.badges.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {store.badges.slice(0, 2).map((badge) => <span key={badge} className="rounded-full bg-sand/50 px-2 py-0.5 text-[10px] font-bold text-ink-muted">{badge}</span>)}
          </div>
        )}
        <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-clay/35 pt-3 text-xs text-ink-muted">
          <span className="flex min-w-0 items-center gap-1"><MapPin size={13} className="shrink-0" /><span className="truncate">{store.city}</span></span>
          <span className="flex shrink-0 items-center gap-2"><Rating value={store.rating} count={store.reviewsCount} /><span className="text-[10px] text-ink-muted/80">{toFa(store.salesCount)} فروش</span></span>
        </div>
      </div>
    </article>
  );
}

export function InspirationCard({ insp, index = 0 }: { insp: InspirationImage; index?: number }) {
  const wishlist = useWishlist();
  const wished = wishlist.inspirations.includes(insp.id);
  const toast = useUi((state) => state.toast);
  return (
    <article className="group relative block h-full min-h-48 overflow-hidden rounded-[var(--radius-lg)] bg-ink shadow-[var(--shadow-soft)]">
      <Link href={`/inspiration/${insp.id}`} className="block h-full" aria-label={`مشاهده ایده ${insp.title}`}>
        <SmartImage src={insp.image} alt={insp.title} className={cn("h-full min-h-48 w-full transition-transform duration-700 group-hover:scale-105", index % 5 === 0 ? "aspect-[3/4]" : index % 5 === 2 ? "aspect-square" : "aspect-[4/5]")} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/5 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-cream sm:p-4">
          <span className="text-[10px] text-gold-soft sm:text-[11px]">{insp.room}</span>
          <h3 className="mt-0.5 text-sm font-black leading-6 text-cream sm:text-base">{insp.title}</h3>
          <div className="mt-1.5 hidden flex-wrap gap-1 sm:flex">{insp.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] backdrop-blur">#{tag}</span>)}</div>
        </div>
      </Link>
      <button type="button" onClick={() => { wishlist.toggleInspiration(insp.id); toast(wished ? "از الهام‌ها حذف شد" : "ایده ذخیره شد"); }} aria-label={wished ? "حذف ایده از علاقه‌مندی" : "ذخیره ایده"} aria-pressed={wished} className={cn("absolute left-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink/48 text-cream backdrop-blur transition hover:bg-ink", wished && "bg-cream text-terracotta-deep")}>
        <Heart size={16} className={cn(wished && "fill-current")} />
      </button>
    </article>
  );
}
