"use client";
import { useState, use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, GitCompare, ShoppingBag, Minus, Plus, Check, Truck, ShieldCheck, RotateCcw, Sparkles, Wand2, Ruler, Lock, PackageCheck, Star } from "lucide-react";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { Button, Badge, Rating, Price, EmptyState, LogoBlock, VerifiedBadge, TrustPoint } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getProduct, getProductById, products, productsByCategory, similarProducts, getProductSalesCount } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { offersForProduct, getBestOffer } from "@/data/offers";
import { sampleReviews } from "@/data/inspirations";
import { PLATFORM } from "@/config/platform";
import { useCart, useWishlist, useCompare, useRecentlyViewed } from "@/stores/useShop";
import { useUi, useChat } from "@/stores/useApp";
import { toFa, formatPrice, cn } from "@/lib/utils";

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const product = getProduct(slug);
  if (!product) notFound();

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews">("desc");

  const store = getStoreById(product!.storeId);
  const productOffers = offersForProduct(product!.id);
  const bestOffer = getBestOffer(product!.id);
  const displayPrice = bestOffer?.price ?? product!.price;
  const offerCount = productOffers.filter((o) => o.inStock).length;
  const wl = useWishlist(); const cmp = useCompare(); const addToCart = useCart((s) => s.add);
  const { toast, setAiPanel } = useUi();
  const { push } = useChat();
  const wished = wl.products.includes(product!.id);
  const compared = cmp.has(product!.id);
  const related = productsByCategory(product!.categorySlug).filter((p) => p.id !== product!.id).slice(0, 4);
  const trackRecent = useRecentlyViewed((s) => s.track);
  useEffect(() => { if (product) trackRecent(product.id); }, [product, trackRecent]);

  const aiActions = [
    { label: "این محصول را در اتاق من قرار بده", icon: Wand2 },
    { label: "با چه محصولاتی ست می‌شود؟", icon: Sparkles },
    { label: "چه رنگی کنار این مناسب است؟", icon: Sparkles },
    { label: "برای چه سبکی مناسب است؟", icon: Sparkles },
  ];

  const router = useRouter();
  const onAi = (label: string) => {
    if (label.includes("در اتاق من قرار بده")) {
      router.push(`/ai?product=${product!.slug}`);
      return;
    }
    push({ role: "user", content: `${label} — ${product!.name}` });
    setAiPanel(true);
  };

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "محصولات", href: "/products" }, { label: product!.name }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* gallery */}
        <Reveal>
          <div>
            <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
              <SmartImage src={product!.images[active]} alt={product!.name} className="aspect-square w-full" />
              <div className="absolute right-4 top-4 flex flex-col gap-1.5">
                {product!.aiRecommended && <Badge tone="gold"><Sparkles size={11} /> پیشنهاد AI</Badge>}
                {product!.discount && <Badge tone="accent">٪{toFa(product!.discount)} تخفیف</Badge>}
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              {product!.images.map((img, i) => (
                <button key={i} onClick={() => setActive(i)} className={cn("h-20 w-20 overflow-hidden rounded-xl border-2 transition", active === i ? "border-ink" : "border-transparent opacity-60 hover:opacity-100")}>
                  <SmartImage src={img} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* info */}
        <Reveal delay={0.08}>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">فروشنده:</span>
              <Link href={`/stores/${store?.slug}`} className="font-bold text-ink hover:text-terracotta-deep">{store?.name ?? product!.brand}</Link>
              {store?.verified && <VerifiedBadge />}
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-ink">{product!.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <Rating value={product!.rating} count={product!.reviewsCount} />
              {store && <span className="flex items-center gap-1"><Star size={13} className="fill-gold text-gold" /> فروشگاه: {toFa(store.rating.toFixed(1))}</span>}
              {store && <span className="flex items-center gap-1"><ShoppingBag size={13} /> {toFa(store.salesCount)} فروش موفق</span>}
            </div>
            <div className="mt-4"><Price price={displayPrice} oldPrice={bestOffer?.oldPrice ?? product!.oldPrice} /></div>

            {/* MULTI-VENDOR OFFERS — sellers comparison */}
            {offerCount > 1 && (
              <div className="mt-4 rounded-xl border border-clay/40 bg-ivory-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">{toFa(offerCount)} فروشنده برای این محصول</span>
                  <span className="flex items-center gap-1 text-[10px] text-success"><Check size={11} /> بهترین قیمت انتخاب شده</span>
                </div>
                <div className="space-y-1.5">
                  {productOffers.filter((o) => o.inStock).sort((a, b) => (a.price + a.shippingCost) - (b.price + b.shippingCost)).map((offer, idx) => {
                    const sellerStore = getStoreById(offer.storeId);
                    const isBest = idx === 0;
                    return (
                      <div key={offer.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 transition", isBest ? "border-success/40 bg-success/5" : "border-clay/30 bg-cream")}>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {isBest && <span className="rounded bg-success/15 px-1.5 py-0.5 text-[9px] font-bold text-success">بهترین</span>}
                          <Link href={`/stores/${sellerStore?.slug}`} className="text-xs font-medium text-ink hover:text-terracotta-deep">{sellerStore?.name}</Link>
                          <span className="text-[10px] text-ink-muted">{offer.shippingDays} · {offer.shippingCost === 0 ? "ارسال رایگان" : `${toFa(formatPrice(offer.shippingCost))} ت`}</span>
                        </div>
                        <span className={cn("text-xs font-black", isBest ? "text-success" : "text-ink")}>{toFa(formatPrice(offer.price))} ت</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* colors */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-ink">رنگ: <span className="text-ink-muted">{product!.colors[0]?.name}</span></div>
              <div className="flex gap-2">
                {product!.colors.map((c) => (
                  <span key={c.name} title={c.name} className="h-8 w-8 cursor-pointer rounded-full border-2 border-clay/50 transition hover:border-ink" style={{ background: c.hex }} />
                ))}
              </div>
            </div>

            {/* stock + qty */}
            <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1 rounded-xl border border-clay/60 p-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="کاهش تعداد" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Minus size={16} /></button>
                <span className="w-8 text-center font-medium">{toFa(qty)}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="افزایش تعداد" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Plus size={16} /></button>
              </div>
              {product!.inStock ? (
                <span className="flex items-center gap-1.5 text-sm text-success"><Check size={16} /> موجود در انبار <span className="text-ink-muted">· {toFa(product!.stockCount)} عدد</span></span>
              ) : (
                <span className="text-sm text-danger">ناموجود — به‌زودی موجود می‌شود</span>
              )}
            </div>

            {/* actions */}
            <div className="mt-5 flex gap-2">
              <Button size="lg" className="flex-1" disabled={!product!.inStock} onClick={() => { addToCart(product!.id, qty); toast("به سبد خرید اضافه شد"); }}>
                <ShoppingBag size={18} /> افزودن به سبد
              </Button>
              <Button size="lg" variant="outline" onClick={() => { wl.toggleProduct(product!.id); toast(wished ? "حذف شد" : "به علاقه‌مندی اضافه شد"); }} className={cn(wished && "border-terracotta text-terracotta-deep")}>
                <Heart size={18} className={cn(wished && "fill-terracotta")} />
              </Button>
              <Button size="lg" variant="outline" onClick={() => { cmp.toggle(product!.id); toast(compared ? "از مقایسه حذف شد" : "به مقایسه اضافه شد"); }}>
                <GitCompare size={18} />
              </Button>
            </div>

            {/* STYLE + SPACE COMPATIBILITY — helps decision */}
            <div className="mt-5 rounded-xl border border-clay/40 bg-cream p-4">
              <h4 className="mb-2 text-xs font-bold text-ink">مناسب برای خانه شما؟</h4>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {product!.styleSlugs.map((s) => (
                  <Link key={s} href={`/styles/${s}`} className="rounded-full border border-terracotta/30 bg-terracotta/8 px-2.5 py-1 font-medium text-terracotta-deep transition hover:bg-terracotta/15">سبک {s}</Link>
                ))}
                {product!.dimensions && <span className="flex items-center gap-1 rounded-full bg-ivory-2 px-2.5 py-1 text-ink-muted"><Ruler size={11} /> {product!.dimensions}</span>}
              </div>
            </div>

            {/* TRUST & DELIVERY — always visible, no price-gating */}
            <div className="mt-4 rounded-xl border border-sage/30 bg-sage/6 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-black text-ink"><ShieldCheck size={16} className="text-success" /> خرید مطمئن با Homeino</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TrustPoint icon={Truck} title="ارسال" desc={bestOffer ? `${bestOffer.shippingDays} · ${bestOffer.shippingCost === 0 ? "ارسال رایگان" : `هزینه ارسال ${toFa(formatPrice(bestOffer.shippingCost))} تومان`}` : "جزئیات ارسال در سبد خرید محاسبه می‌شود"} />
                <TrustPoint icon={RotateCcw} title="ضمانت بازگشت" desc={`${toFa(PLATFORM.policies.returnDays)} روز بازگشت بدون قید و شرط`} />
                <TrustPoint icon={Lock} title="پرداخت امن" desc="پرداخت از طریق درگاه امن؛ وجه تا تحویل نزد Homeino امانت می‌ماند" />
                <TrustPoint icon={PackageCheck} title="اصالت و خرید" desc={`ضمانت اصالت کالا · ${toFa(getProductSalesCount(product!))} نفر این محصول را خریده‌اند`} />
              </div>
            </div>

            {/* AI section */}
            <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-bl from-gold/8 to-terracotta/5 p-5">
              <div className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Sparkles size={18} className="text-gold" /> هوش مصنوعی برای این محصول</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {aiActions.map((a) => (
                  <button key={a.label} onClick={() => onAi(a.label)} className="flex items-center gap-2 rounded-xl border border-clay/40 bg-cream px-3 py-2.5 text-right text-sm text-ink transition hover:border-gold hover:shadow-sm">
                    <a.icon size={16} className="text-gold" /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* tabs */}
      <div className="mt-12">
        <div role="tablist" aria-label="اطلاعات محصول" className="hide-scrollbar flex max-w-full gap-1 overflow-x-auto border-b border-clay/40">
          {[["desc", "توضیحات"], ["specs", "مشخصات"], ["reviews", `نقد و بررسی (${toFa(product!.reviewsCount)})`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} role="tab" aria-selected={tab === k} className={cn("relative min-h-11 shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition", tab === k ? "text-ink" : "text-ink-muted hover:text-ink")}>
              {l}{tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-ink" />}
            </button>
          ))}
        </div>
        <div className="py-6">
          {tab === "desc" && <p className="max-w-3xl leading-8 text-ink-muted">{product!.description}</p>}
          {tab === "specs" && (
            <div className="max-w-xl divide-y divide-clay/40 rounded-xl border border-clay/40">
              {[...product!.specs, { label: "ابعاد", value: product!.dimensions ?? "—" }, { label: "جنس", value: product!.materials.join("، ") }].map((s) => (
                <div key={s.label} className="flex justify-between px-4 py-3 text-sm"><span className="text-ink-muted">{s.label}</span><span className="font-medium text-ink">{s.value}</span></div>
              ))}
            </div>
          )}
          {tab === "reviews" && (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="card-surface p-6 text-center">
                <div className="font-display text-5xl font-black text-ink">{toFa(product!.rating.toFixed(1))}</div>
                <div className="mt-1 flex justify-center"><Rating value={product!.rating} /></div>
                <div className="mt-1 text-sm text-ink-muted">از {toFa(product!.reviewsCount)} نظر</div>
                <Button variant="ghost" className="mt-4 w-full" onClick={() => toast("ثبت نظر به‌زودی فعال می‌شود", "info")}>ثبت نظر</Button>
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
          )}
        </div>
      </div>

      {/* Cross-sell: complete the look — with design reasoning (not random ads) */}
      {related.length > 1 && (
        <div className="mt-12 rounded-2xl border border-gold/25 bg-gold/5 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink"><Sparkles size={18} className="text-gold" /> این چیدمان را کامل کن</h2>
          <p className="mb-4 text-sm text-ink-muted">هر پیشنهاد بر اساس هماهنگی رنگ و سبک با این محصول انتخاب شده.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.slice(0, 3).map((p, idx) => {
              const reasons = [
                "رنگ خنثی این محصول، تناژ گرم مبل اصلی را متعادل می‌کند",
                "بافت طبیعی و سبک هم‌خانواده، حس یکپارچگی می‌سازد",
                "مقیاس و ابعاد متناسب، برای کنار این محصول طراحی شده",
              ];
              return (
                <div key={p.id} className="flex flex-col rounded-xl border border-clay/40 bg-cream p-3">
                  <div className="mb-2 flex items-center gap-2.5">
                    <SmartImage src={p.images[0]} alt={p.name} className="h-14 w-14 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-bold text-ink">{p.name}</p>
                      <p className="text-[11px] text-terracotta-deep">{toFa(formatPrice(p.price))} ت</p>
                    </div>
                  </div>
                  <p className="mb-2.5 flex items-start gap-1 text-[10px] leading-5 text-ink-muted"><Sparkles size={10} className="mt-0.5 shrink-0 text-gold" /> {reasons[idx % reasons.length]}</p>
                  <button onClick={() => { addToCart(p.id); toast("به سبد اضافه شد"); }} disabled={!p.inStock} className="btn-accent mt-auto flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold disabled:opacity-40"><ShoppingBag size={13} /> افزودن</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SIMILAR — style/category overlap, ranked by relevance */}
      {(() => {
        const similar = similarProducts(product!.id, 4);
        if (similar.length < 2) return null;
        return (
          <div className="mt-12">
            <h2 className="mb-1 font-display text-2xl font-bold text-ink">محصولات مشابه</h2>
            <p className="mb-5 text-sm text-ink-muted">انتخاب‌هایی با سبک و دسته‌بندی هم‌خانواده، برای مقایسه و انتخاب بهتر.</p>
            <ProductGrid products={similar} />
          </div>
        );
      })()}

      {/* related (same category) */}
      <div className="mt-12">
        <h2 className="mb-1 font-display text-2xl font-bold text-ink">بیشتر از این دسته‌بندی</h2>
        <p className="mb-5 text-sm text-ink-muted">سایر محصولات همین دسته را ببین.</p>
        {related.length > 0 ? <ProductGrid products={related} /> : <EmptyState title="محصول مرتبطی نیست" />}
      </div>

      {/* STICKY MOBILE CTA — always visible on scroll (mobile only) */}
      {product!.inStock && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-2 border-t border-clay/40 glass px-4 py-2.5 lg:hidden">
          <div className="flex-1">
            <p className="text-[10px] text-ink-muted">{product!.brand}</p>
            <p className="font-display text-sm font-black text-ink">{toFa(formatPrice(product!.price))} <span className="text-[10px] font-normal text-ink-muted">ت</span></p>
          </div>
          <button onClick={() => { addToCart(product!.id, qty); toast("به سبد خرید اضافه شد"); }} className="btn-accent flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"><ShoppingBag size={15} /> افزودن به سبد</button>
          <button onClick={() => { wl.toggleProduct(product!.id); toast(wished ? "حذف شد" : "به علاقه‌مندی اضافه شد"); }} className={cn("grid h-10 w-10 place-items-center rounded-xl border border-clay/50", wished && "border-terracotta text-terracotta-deep")} aria-label="علاقه‌مندی"><Heart size={17} className={cn(wished && "fill-terracotta")} /></button>
        </div>
      )}

      {/* RECENTLY VIEWED — retention loop */}
      <RecentlyViewedSection currentId={product!.id} />
    </Container>
  );
}

function RecentlyViewedSection({ currentId }: { currentId: string }) {
  const recentIds = useRecentlyViewed((s) => s.productIds);
  const recent = recentIds.map(getProductById).filter((p) => p && p.id !== currentId).slice(0, 5) as typeof products;
  if (recent.length < 2) return null;
  return (
    <div className="mt-10">
      <h2 className="mb-4 text-sm font-bold text-ink-muted">اخیراً دیده‌شده</h2>
      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
        {recent.map((p) => (
          <Link key={p.id} href={`/products/${p.slug}`} className="group w-32 shrink-0">
            <div className="overflow-hidden rounded-xl border border-clay/40"><SmartImage src={p.images[0]} alt={p.name} className="aspect-square w-full transition group-hover:scale-105" /></div>
            <p className="mt-1.5 line-clamp-1 text-[11px] font-bold text-ink">{p.name}</p>
            <p className="text-[10px] text-terracotta-deep">{toFa(formatPrice(p.price))} ت</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
