"use client";
import Link from "next/link";
import { Heart, GitCompare, ShoppingBag, MapPin, BadgeCheck, Star } from "lucide-react";
import type { Product, Store, InspirationImage } from "@/types";
import { useWishlist, useCompare, useCart } from "@/stores/useShop";
import { useUi as useUiStore } from "@/stores/useApp";
import { cn, toFa, formatPrice } from "@/lib/utils";
import { SmartImage } from "./ui/SmartImage";
import { Badge, Price, Rating, LogoBlock } from "./ui/primitives";

export function ProductCard({ product }: { product: Product }) {
  const wl = useWishlist();
  const cmp = useCompare();
  const addToCart = useCart((s) => s.add);
  const toast = useUiStore((s) => s.toast);
  const wished = wl.products.includes(product.id);
  const compared = cmp.has(product.id);

  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-lg)] bg-ink shadow-[var(--shadow-soft)] transition-transform duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:aspect-[3/4]">
      {/* Image fills the entire card */}
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden sm:aspect-auto sm:h-full" aria-label={product.name}>
        <SmartImage src={product.images[0]} alt={product.name} className="absolute inset-0 h-full w-full" />
        {/* top badges */}
        <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
          {product.discount ? <Badge tone="accent">٪{product.discount} تخفیف</Badge> : null}
          {product.isNew && <Badge tone="dark">جدید</Badge>}
          {product.aiRecommended && <Badge tone="gold">پیشنهاد AI</Badge>}
        </div>
      </Link>

      {/* ===== MOBILE: always-visible floating actions (no hover needed) ===== */}
      <div className="absolute left-2 top-2 z-20 flex flex-col gap-1.5 lg:hidden">
        <button
          aria-label="افزودن به علاقه‌مندی"
          onClick={() => { wl.toggleProduct(product.id); toast(wished ? "از علاقه‌مندی حذف شد" : "به علاقه‌مندی اضافه شد"); }}
          className={cn("grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-cream backdrop-blur transition active:scale-90", wished && "text-rose-400")}
        >
          <Heart size={16} className={cn(wished && "fill-current")} />
        </button>
        <button
          aria-label="افزودن به مقایسه"
          onClick={() => { cmp.toggle(product.id); toast(compared ? "از مقایسه حذف شد" : "به مقایسه اضافه شد"); }}
          className={cn("grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-cream backdrop-blur transition active:scale-90", compared && "text-gold-soft")}
        >
          <GitCompare size={16} />
        </button>
      </div>

      {/* always-visible bottom gradient with name + price */}
      <Link href={`/products/${product.slug}`} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/85 to-transparent pb-3 pt-14">
        <div className="px-3">
          <p className="line-clamp-1 text-sm font-bold text-cream">{product.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm font-black text-gold-soft">{toFa(formatPrice(product.price))}</span>
            {product.oldPrice && <span className="text-[11px] text-cream/50 line-through">{toFa(formatPrice(product.oldPrice))}</span>}
          </div>
        </div>
      </Link>

      {/* ===== DESKTOP HOVER OVERLAY: full info + actions (lg and up only) ===== */}
      <div className="absolute inset-0 z-30 hidden flex-col bg-ink/94 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:flex">
        {/* info at top */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gold-soft">{product.brand}</span>
            <span className="flex items-center gap-1 text-xs text-cream">
              <Star size={12} className="fill-gold text-gold" />
              <span className="font-bold">{toFa(product.rating.toFixed(1))}</span>
              <span className="text-cream/70">({toFa(product.reviewsCount)})</span>
            </span>
          </div>
          <Link href={`/products/${product.slug}`} className="block line-clamp-2 text-sm font-bold leading-snug text-cream hover:text-gold-soft">{product.name}</Link>
          <div className="flex items-center gap-1.5 pt-0.5">
            {product.colors.slice(0, 4).map((c) => (
              <span key={c.name} className="h-4 w-4 rounded-full border border-cream/40" style={{ background: c.hex }} title={c.name} />
            ))}
            <span className="text-[10px] text-cream/80">{product.colors[0]?.name}</span>
          </div>
          <div className="pt-1.5">
            <span className="text-lg font-black text-gold-soft">{toFa(formatPrice(product.price))} </span>
            <span className="text-xs text-cream/80">تومان</span>
            {product.oldPrice && <span className="mr-2 text-xs text-cream/50 line-through">{toFa(formatPrice(product.oldPrice))}</span>}
          </div>
        </div>

        {/* action buttons at bottom — min touch target 44px */}
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <button
            aria-label="افزودن به علاقه‌مندی"
            onClick={() => { wl.toggleProduct(product.id); toast(wished ? "از علاقه‌مندی حذف شد" : "به علاقه‌مندی اضافه شد"); }}
            className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-bold transition", wished ? "border-terracotta-soft bg-terracotta-soft/20 text-terracotta-soft" : "border-cream/30 bg-cream/5 text-cream hover:bg-cream/15")}
          >
            <Heart size={14} className={cn(wished && "fill-current")} /> علاقه‌مندی
          </button>
          <button
            aria-label="افزودن به مقایسه"
            onClick={() => { cmp.toggle(product.id); toast(compared ? "از مقایسه حذف شد" : "به مقایسه اضافه شد"); }}
            className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-bold transition", compared ? "border-gold-soft bg-gold/20 text-gold-soft" : "border-cream/30 bg-cream/5 text-cream hover:bg-cream/15")}
          >
            <GitCompare size={14} /> مقایسه
          </button>
          <button
            aria-label="افزودن به سبد خرید"
            onClick={() => { addToCart(product.id); toast("به سبد خرید اضافه شد"); }}
            disabled={!product.inStock}
            className="btn-accent grid h-11 w-11 shrink-0 place-items-center rounded-lg disabled:opacity-40"
          >
            <ShoppingBag size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StoreCard({ store }: { store: Store }) {
  const wl = useWishlist();
  const wished = wl.stores.includes(store.id);
  return (
    <Link href={`/stores/${store.slug}`} className="group card-surface relative overflow-hidden">
      <div className="relative h-28 overflow-hidden">
        <SmartImage src={store.cover} alt={store.name} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-ink/35" />
        {store.verified && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-cream/90 px-2 py-0.5 text-[11px] font-medium text-ink">
            <BadgeCheck size={13} className="text-sage" /> تأیید شده
          </span>
        )}
        {store.isNew && <span className="absolute left-3 top-3"><Badge tone="accent">جدید</Badge></span>}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-7 mb-2 flex items-end justify-between">
          <LogoBlock char={store.logo} color={store.logoColor} size={56} />
          <button
            onClick={(e) => { e.preventDefault(); wl.toggleStore(store.id); }}
            className={cn("mb-1 grid h-9 w-9 place-items-center rounded-full glass border border-clay/40", wished && "text-terracotta-deep")}
          >
            <Heart size={16} className={cn(wished && "fill-terracotta")} />
          </button>
        </div>
        <h3 className="font-display font-bold text-ink transition group-hover:text-terracotta-deep">{store.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{store.description}</p>
        <div className="mt-3 flex items-center justify-between border-t border-clay/40 pt-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1"><MapPin size={13} /> {store.city}</span>
          <Rating value={store.rating} count={store.reviewsCount} />
        </div>
      </div>
    </Link>
  );
}

export function InspirationCard({ insp, index = 0 }: { insp: InspirationImage; index?: number }) {
  const wl = useWishlist();
  const wished = wl.inspirations.includes(insp.id);
  return (
    <Link href={`/inspiration/${insp.id}`} className="group relative block overflow-hidden rounded-[var(--radius-lg)]">
      <SmartImage
        src={insp.image}
        alt={insp.title}
        className={cn("w-full transition-transform duration-700 group-hover:scale-105", index % 5 === 0 ? "aspect-[3/4]" : index % 5 === 2 ? "aspect-square" : "aspect-[4/5]")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
      <button
        onClick={(e) => { e.preventDefault(); wl.toggleInspiration(insp.id); }}
        className={cn("absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full glass border border-clay/40 transition", wished ? "text-terracotta-deep" : "text-cream")}
      >
        <Heart size={16} className={cn(wished && "fill-terracotta")} />
      </button>
      <div className="absolute bottom-0 right-0 p-4 text-cream">
        <span className="text-[11px] opacity-80">{insp.room}</span>
        <h3 className="font-display text-base font-bold leading-tight">{insp.title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {insp.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-cream/15 px-2 py-0.5 text-[10px] backdrop-blur">#{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
