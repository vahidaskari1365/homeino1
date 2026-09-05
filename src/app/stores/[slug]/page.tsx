"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Package, Star, Timer, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { Button, LogoBlock, Chip, Badge, Rating } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getStore } from "@/data/stores";
import { resolvePublicStore, allStoreProductsPublic } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { getStorefrontProfile, reviewsForStore } from "@/data/storefronts";
import { useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";

export default function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  // re-render once the persisted vendor session lands (post-hydration) so the
  // demo vendor's saved profile/products show up without any user action
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // The demo vendor's session edits (name/cover/logo/policies) and added
  // products are merged here — what the vendor saves is what visitors see.
  const base = getStore(slug);
  if (!base) notFound();
  const store = resolvePublicStore(base);
  const products = allStoreProductsPublic(base.id);
  const [sort, setSort] = useState<"all" | "trending" | "discount">("all");
  const wl = useWishlist(); const { toast } = useUi();
  const profile = getStorefrontProfile(store!.id);
  const storeReviews = reviewsForStore(store!.id);
  const wished = wl.stores.includes(store!.id);
  const list = products.filter((p) => sort === "all" ? true : sort === "trending" ? p.trending : p.oldPrice);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "فروشگاه‌ها", href: "/stores" }, { label: store!.name }]} />

      <Reveal>
        <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
          <SmartImage src={store!.cover} alt={store!.name} className="h-48 w-full sm:h-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-ink/20" />
        </div>
        <div className="relative -mt-12 flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="card-surface p-2"><LogoBlock char={store!.logo} color={store!.logoColor} size={72} /></div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-black text-ink">{store!.name}</h1>
                {store!.verified && <BadgeCheck size={20} className="text-sage" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                <span className="flex items-center gap-1"><MapPin size={14} /> {store!.city}</span>
                <span className="flex items-center gap-1"><Package size={14} /> {toFa(products.length)} محصول</span>
                <span className="flex items-center gap-1"><Star size={14} className="fill-gold text-gold" /> {toFa(store!.rating.toFixed(1))} ({toFa(store!.reviewsCount)})</span>
              </div>
            </div>
          </div>
          <Button variant={wished ? "primary" : "outline"} onClick={() => { wl.toggleStore(store!.id); toast(wished ? "حذف شد" : "فروشگاه دنبال شد"); }} className="mb-2">
            {wished ? "دنبال می‌کنی ✓" : "دنبال کردن فروشگاه"}
          </Button>
        </div>
      </Reveal>

      <p className="mt-6 max-w-2xl leading-8 text-ink-muted">{store!.description}</p>

      {profile && (
        <div className="mt-5 flex flex-wrap gap-2">
          {store!.verified && <span className="flex items-center gap-1.5 rounded-full border border-clay/50 bg-ivory-2 px-3 py-1.5 text-xs text-ink"><ShieldCheck size={13} className="text-sage" /> تأییدشده توسط Homeino</span>}
          <span className="flex items-center gap-1.5 rounded-full border border-clay/50 bg-ivory-2 px-3 py-1.5 text-xs text-ink"><Timer size={13} className="text-terracotta-deep" /> پاسخ‌گویی {profile.responseTime}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-clay/50 bg-ivory-2 px-3 py-1.5 text-xs text-ink"><Truck size={13} className="text-terracotta-deep" /> {profile.shippingCoverage}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-clay/50 bg-ivory-2 px-3 py-1.5 text-xs text-ink"><RotateCcw size={13} className="text-terracotta-deep" /> {toFa(profile.returnDays)} روز بازگشت</span>
        </div>
      )}

      {/* Trust, policies & store reviews — from stores.ts / storefronts.ts (existing components) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><ShieldCheck size={18} className="text-sage" /> اعتماد و سیاست‌های فروشگاه</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {store!.badges.map((badge) => <Badge key={badge} tone="success">{badge}</Badge>)}
            <Badge tone="dark">از سال {toFa(store!.sinceYear)}</Badge>
            <Badge tone="accent">{toFa(store!.salesCount)} فروش موفق</Badge>
          </div>
          <div className="space-y-3 text-sm leading-7">
            <div><span className="font-bold text-ink">سیاست ارسال: </span><span className="text-ink-muted">{store!.shippingPolicy}</span></div>
            <div><span className="font-bold text-ink">سیاست بازگشت: </span><span className="text-ink-muted">{store!.returnPolicy}</span></div>
          </div>
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Star size={18} className="fill-gold text-gold" /> نظرات خریداران</h2>
          {storeReviews.length ? (
            <div className="space-y-3">
              {storeReviews.map((review) => (
                <div key={review.id} className="border-b border-clay/30 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><LogoBlock char={review.author[0]} color="#6b6358" size={30} /><div><div className="text-sm font-medium text-ink">{review.author}</div><div className="text-xs text-ink-muted">{review.date}</div></div></div>
                    <Rating value={review.rating} size={13} />
                  </div>
                  <p className="mt-2 text-sm leading-7 text-ink-muted">{review.comment}</p>
                  {review.verifiedPurchase && <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-sage"><BadgeCheck size={12} /> خرید تأییدشده</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">هنوز نظری برای این فروشگاه ثبت نشده است.</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[["all", "همه"], ["trending", "محبوب‌ها"], ["discount", "تخفیف‌دار"]].map(([k, l]) => (
          <Chip key={k} active={sort === k} onClick={() => setSort(k as typeof sort)}>{l}</Chip>
        ))}
      </div>

      <FilterableProductGrid
        products={list}
        layout="compact"
        className="mt-6"
        emptyDescription="فیلتر سبک یا سایر فیلترهای محصولات این فروشگاه را تغییر بده."
      />
    </Container>
  );
}
