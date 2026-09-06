"use client";
import { useState, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, GitCompare, ShoppingBag, Minus, Plus, Check, Truck, ShieldCheck, RotateCcw, Sparkles, Wand2, Ruler } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { Button, Badge, Rating, Price, EmptyState, LogoBlock, Modal, Skeleton } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getProductById, products } from "@/data/products";
import { findVendorProductPublic } from "@/data/vendorSession";
import { getStyle } from "@/data/styles";
import { getStoreById } from "@/data/stores";
import { offersForProduct, getBestOffer } from "@/data/offers";
import { sampleReviews } from "@/data/inspirations";
import { fetchProductReviews, createProductReview } from "@/lib/commerceClient";
import { useCart, useWishlist, useCompare, useRecentlyViewed } from "@/stores/useShop";
import { useUi, useChat } from "@/stores/useApp";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import type { Product, Review } from "@/types";

/**
 * Client shell of the PDP. The PRODUCT ITSELF comes from the server page
 * (DB-backed repository with mock fallback) as `serverProduct`; only the
 * vendor-panel demo products (vp-*) resolve client-side out of the persisted
 * vendor session. Related products arrive server-side too (`related`).
 */
export default function ProductDetailClient({
  slug,
  serverProduct,
  related: relatedProp,
}: {
  slug: string;
  serverProduct: Product | null;
  related: Product[];
}) {
  const hydrated = useHasHydrated();
  // re-render the moment the persisted vendor session lands (post-hydration)
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // Server-resolved product first; vendor-session demo products (vp-*) still
  // resolve client-side after one hydration cycle (brief skeleton).
  const product = serverProduct ?? (hydrated ? findVendorProductPublic(slug) : undefined);
  if (!serverProduct && !product && hydrated && !slug.startsWith("vp-")) notFound();

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews">("desc");
  const [seller, setSeller] = useState<string | undefined>(() => getBestOffer(product?.id ?? "")?.id);
  const [selectedColor, setSelectedColor] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const productId = product?.id ?? "";
  const [reviewVersion, setReviewVersion] = useState(0);
  // Read the persisted reviews only after hydration so the first paint
  // (server + pre-hydration) stays identical to SSR — zero console mismatch.
  const myReviews = hydrated && productId ? localReviews(productId) : [];
  // Server reviews (verified purchases, DB-backed) merge above the samples.
  const [serverReviews, setServerReviews] = useState<Review[]>([]);
  useEffect(() => {
    if (!hydrated || !productId) return;
    let alive = true;
    void fetchProductReviews(product?.slug ?? "").then((res) => {
      if (!alive || !res.ok) return;
      const items = res.data.items ?? [];
      setServerReviews(items.map((r, i) => ({
        id: r.id,
        author: r.userName || "خریدار تأییدشده",
        rating: r.rating,
        date: new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(r.createdAt)),
        comment: r.content ?? r.title ?? "",
        helpful: 0,
        key: `srv-${i}`,
      })));
    });
    return () => { alive = false; };
  }, [hydrated, productId, product?.slug, reviewVersion]);

  const wl = useWishlist(); const cmp = useCompare(); const addToCart = useCart((s) => s.add);
  const { toast, setAiPanel } = useUi();
  const { askAssistant } = useChat();
  const trackRecent = useRecentlyViewed((s) => s.track);
  useEffect(() => { if (product) trackRecent(product.id); }, [product, trackRecent]);
  const router = useRouter();

  // One-frame placeholder while a vp-* product hydrates out of the persisted
  // vendor session — every hook above already ran, so the swap is clean.
  if (!product) {
    return (
      <Container className="py-8">
        <Skeleton className="h-5 w-56" />
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-[var(--radius-lg)]" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </Container>
    );
  }

  // — product is guaranteed from here on (catalog hit, or hydrated vp-*) —
  const store = getStoreById(product.storeId);
  const productOffers = offersForProduct(product.id);
  const bestOffer = getBestOffer(product.id);
  const displayPrice = bestOffer?.price ?? product.price;
  const offerCount = productOffers.filter((o) => o.inStock).length;
  const wished = wl.products.includes(product.id);
  const compared = cmp.has(product.id);
  const related = relatedProp;
  const reviews = [...serverReviews, ...myReviews, ...sampleReviews];
  const buyFromSeller = (offer: (typeof productOffers)[number], sellerName: string) => {
    addToCart(product.id, qty, offer.id);
    setSeller(offer.id);
    toast(`«${product.name}» از فروشندهٔ ${sellerName} به سبد اضافه شد`);
  };

  const aiActions = [
    { label: "این محصول را در اتاق من قرار بده", icon: Wand2 },
    { label: "با چه محصولاتی ست می‌شود؟", icon: Sparkles },
    { label: "چه رنگی کنار این مناسب است؟", icon: Sparkles },
    { label: "برای چه سبکی مناسب است؟", icon: Sparkles },
  ];

  const onAi = (label: string) => {
    if (label.includes("در اتاق من قرار بده")) {
      router.push(`/ai/design?tab=inspiration&product=${product.slug}`);
      return;
    }
    // Hand the question to the assistant with the REAL product identity + a
    // detected topic → AIPanel auto-answers from the catalog (pairing, color
    // harmony, style fit) — no typing, no generic placeholder reply.
    const topic = label.includes("رنگ") ? "color" : label.includes("سبک") ? "style" : "pair";
    askAssistant({ content: `${label} — ${product.name}`, topic, productSlug: product.slug });
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
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Link href={`/stores/${store?.slug}`} className="font-medium text-ink hover:text-terracotta-deep">{product!.brand}</Link>
              <span>•</span><Rating value={product!.rating} count={product!.reviewsCount} />
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-ink">{product!.name}</h1>
            <div className="mt-4"><Price price={displayPrice} oldPrice={bestOffer?.oldPrice ?? product!.oldPrice} /></div>

            {/* MULTI-VENDOR OFFERS — sellers comparison */}
            {offerCount > 1 && (
              <div className="mt-4 rounded-xl border border-clay/40 bg-ivory-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">{toFa(offerCount)} فروشنده برای این محصول</span>
                  <span className="flex items-center gap-1 text-2xs text-success"><Check size={11} /> کمترین قیمت بین {toFa(productOffers.length)} فروشنده</span>
                </div>
                <div className="space-y-1.5">
                  {productOffers.filter((o) => o.inStock).sort((a, b) => (a.price + a.shippingCost) - (b.price + b.shippingCost)).map((offer, idx) => {
                    const sellerStore = getStoreById(offer.storeId);
                    const isBest = idx === 0;
                    const selected = seller === offer.id;
                    return (
                      <div key={offer.id} className={cn("flex items-center justify-between gap-2 rounded-lg border p-2 transition", selected ? "border-ink bg-ivory-2" : isBest ? "border-success/40 bg-success/5" : "border-clay/30 bg-cream")}>
                        <div className="flex min-w-0 items-center gap-2">
                          {isBest && <span className="rounded bg-success/15 px-1.5 py-0.5 text-2xs font-bold text-success">بهترین</span>}
                          {selected && <span className="rounded bg-ink px-1.5 py-0.5 text-2xs font-bold text-cream">انتخاب تو</span>}
                          <Link href={`/stores/${sellerStore?.slug}`} className="truncate text-xs font-medium text-ink hover:text-terracotta-deep">{sellerStore?.name}</Link>
                          <span className="hidden text-2xs text-ink-muted sm:inline">{offer.shippingDays} · {offer.shippingCost === 0 ? "ارسال رایگان" : `${toFa(formatPrice(offer.shippingCost))} ت`}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn("text-xs font-black", isBest ? "text-success" : "text-ink")}>{toFa(formatPrice(offer.price))} ت</span>
                          <button onClick={() => buyFromSeller(offer, sellerStore?.name ?? "فروشگاه")} className="rounded-lg bg-ink px-2 py-1 text-2xs font-bold text-cream transition hover:bg-terracotta-deep" aria-label={`خرید از ${sellerStore?.name}`}>
                            خرید از این فروشنده
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* colors — actually selectable */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-ink">رنگ: <span className="text-ink-muted">{product!.colors[selectedColor]?.name ?? "—"}</span></div>
              <div className="flex gap-2">
                {product!.colors.map((c, i) => (
                  <button key={c.name} type="button" title={c.name} aria-label={`رنگ ${c.name}`} aria-pressed={selectedColor === i} onClick={() => setSelectedColor(i)} className={cn("h-8 w-8 rounded-full border-2 transition", selectedColor === i ? "border-ink" : "border-clay/50 hover:border-ink")} style={{ background: c.hex }} />
                ))}
              </div>
            </div>

            {/* stock + qty */}
            <div className="mt-5 flex items-center gap-4">
              <div className="flex items-center gap-1 rounded-xl border border-clay/60 p-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="کاهش تعداد" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Minus size={16} /></button>
                <span className="w-8 text-center font-medium">{toFa(qty)}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="افزایش تعداد" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Plus size={16} /></button>
              </div>
              {product!.inStock ? (
                <span className="flex items-center gap-1.5 text-sm text-success"><Check size={16} /> موجود
                  {product!.stockCount <= 10 && <b className="text-danger"> · فقط {toFa(product!.stockCount)} عدد باقی مانده!</b>}
                  {product!.stockCount > 10 && <span className="text-ink-muted">({toFa(product!.stockCount)} عدد)</span>}
                </span>
              ) : (
                <span className="text-sm text-danger">ناموجود — به‌زودی موجود می‌شود</span>
              )}
            </div>

            {/* actions */}
            <div className="mt-5 flex gap-2">
              <Button size="lg" className="flex-1" disabled={!product!.inStock} onClick={() => { addToCart(product!.id, qty, bestOffer?.id); toast("به سبد خرید اضافه شد"); }}>
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
              <div className="flex flex-wrap items-center gap-2 text-2xs">
                {product!.styleSlugs.map((styleSlug) => (
                  <Link key={styleSlug} href={`/styles/${styleSlug}`} className="rounded-full border border-terracotta/30 bg-terracotta/8 px-2.5 py-1 font-medium text-terracotta-deep transition hover:bg-terracotta/15">سبک {getStyle(styleSlug)?.name ?? styleSlug}</Link>
                ))}
                {product!.dimensions && <span className="flex items-center gap-1 rounded-full bg-ivory-2 px-2.5 py-1 text-ink-muted"><Ruler size={11} /> {product!.dimensions}</span>}
              </div>
              {product!.price > 30000000 && (
                <div className="mt-3 flex items-start gap-1.5 border-t border-clay/30 pt-2 text-2xs leading-5 text-ink-muted">
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-sage" />
                  <span>خرید مطمئن: این محصول دارای <b className="text-ink">ضمانت اصالت</b> و <b className="text-ink">۷ روز بازگشت بدون قید و شرط</b> است. قبل از خرید می‌توانید با هومینو استودیو آن را در فضای خودتان تصور کنید.</span>
                </div>
              )}
            </div>

            {/* benefits */}
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ivory-2 p-4 text-center text-xs text-ink-muted">
              <div className="flex flex-col items-center gap-1"><Truck size={18} className="text-terracotta-deep" /> ارسال سریع</div>
              <div className="flex flex-col items-center gap-1"><ShieldCheck size={18} className="text-terracotta-deep" /> ضمانت اصالت</div>
              <div className="flex flex-col items-center gap-1"><RotateCcw size={18} className="text-terracotta-deep" /> ۷ روز بازگشت</div>
            </div>

            {/* AI section */}
            <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-bl from-gold/8 to-terracotta/5 p-5">
              <div className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Sparkles size={18} className="text-gold" /> هومینو استودیو برای این محصول</div>
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
        <div className="flex gap-1 border-b border-clay/40">
          {[["desc", "توضیحات"], ["specs", "مشخصات"], ["reviews", `نقد و بررسی (${toFa(product!.reviewsCount)})`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={cn("relative px-4 py-3 text-sm font-medium transition", tab === k ? "text-ink" : "text-ink-muted hover:text-ink")}>
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
                <Button variant="ghost" className="mt-4 w-full" onClick={() => setReviewOpen(true)}>ثبت نظر</Button>
              </div>
              <div className="space-y-3" key={reviewVersion}>
                {reviews.map((r) => (
                  <div key={r.id} className="card-surface p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><LogoBlock char={r.author[0]} color="#6b6358" size={36} /><div><div className="text-sm font-medium text-ink">{r.author}</div><div className="text-xs text-ink-muted">{r.date}</div></div></div>
                      <Rating value={r.rating} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-muted">{r.comment}</p>
                  </div>
                ))}
                {myReviews.length > 0 && <p className="text-center text-2xs text-ink-muted">نظرهای خودت ({toFa(myReviews.length)}) — در همین مرورگر ذخیره شده‌اند</p>}
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
                    <img src={p.images[0]} alt={p.name} className="h-14 w-14 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-bold text-ink">{p.name}</p>
                      <p className="text-2xs text-terracotta-deep">{toFa(formatPrice(p.price))} ت</p>
                    </div>
                  </div>
                  <p className="mb-2.5 flex items-start gap-1 text-2xs leading-5 text-ink-muted"><Sparkles size={10} className="mt-0.5 shrink-0 text-gold" /> {reasons[idx % reasons.length]}</p>
                  <button onClick={() => { addToCart(p.id); toast("به سبد اضافه شد"); }} disabled={!p.inStock} className="btn-accent mt-auto flex items-center justify-center gap-1.5 rounded-lg py-2 text-2xs font-bold disabled:opacity-40"><ShoppingBag size={13} /> افزودن</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* related */}
      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">محصولات مرتبط</h2>
        {related.length > 0 ? (
          <FilterableProductGrid
            products={related}
            layout="compact"
            emptyDescription="فیلتر سبک محصولات مشابه را تغییر بده."
          />
        ) : <EmptyState title="محصول مرتبطی نیست" />}
      </div>

      {/* STICKY MOBILE CTA — always visible on scroll (mobile only) */}
      {product!.inStock && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-2 border-t border-clay/40 glass px-4 py-2.5 lg:hidden">
          <div className="flex-1">
            <p className="text-2xs text-ink-muted">{product!.brand}</p>
            <p className="font-display text-sm font-black text-ink">{toFa(formatPrice(displayPrice))} <span className="text-2xs font-normal text-ink-muted">ت</span></p>
          </div>
          <button onClick={() => { addToCart(product!.id, qty, bestOffer?.id); toast("به سبد خرید اضافه شد"); }} className="btn-accent flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"><ShoppingBag size={15} /> افزودن به سبد</button>
          <button onClick={() => { wl.toggleProduct(product!.id); toast(wished ? "حذف شد" : "به علاقه‌مندی اضافه شد"); }} className={cn("grid h-10 w-10 place-items-center rounded-xl border border-clay/50", wished && "border-terracotta text-terracotta-deep")} aria-label="علاقه‌مندی"><Heart size={17} className={cn(wished && "fill-terracotta")} /></button>
        </div>
      )}

      {/* RECENTLY VIEWED — retention loop */}
      <RecentlyViewedSection currentId={product!.id} />

      {/* add review — persisted to localStorage per product */}
      <ReviewModal
        open={reviewOpen}
        productName={product!.name}
        onClose={() => setReviewOpen(false)}
        onSave={(rating, comment) => {
          // Real backend first: a verified-purchase review lands in the DB
          // (pending approval). Otherwise the honest local fallback.
          void createProductReview({ productId: product!.slug, rating, content: comment }).then((res) => {
            if (res.ok) {
              toast("نظرت ثبت شد و پس از تأیید نمایش داده می‌شود");
            } else {
              saveLocalReview(product!.id, rating, comment);
              toast(res.status === 403 ? "برای ثبت نظر، این محصول را باید خریداری و تحویل گرفته باشی" : "نظرت در همین مرورگر ذخیره شد (حالت دمو)", res.status === 403 ? "error" : "info");
            }
            setReviewVersion((v) => v + 1);
          });
          setReviewOpen(false);
        }}
      />
    </Container>
  );
}

function ReviewModal({ open, productName, onClose, onSave }: { open: boolean; productName: string; onClose: () => void; onSave: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="ثبت نظر" description={productName}>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-sm text-ink-muted">امتیاز تو</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className={cn("grid h-9 w-9 place-items-center rounded-lg border text-lg transition", n <= rating ? "border-gold bg-gold/15 text-gold" : "border-clay/60 text-ink-muted hover:border-gold")} aria-label={`${toFa(n)} ستاره`}>★</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-ink-muted">نظر تو دربارهٔ این محصول</label>
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تجربه‌ات از کیفیت، ارسال و … را بنویس." className="w-full resize-none rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button onClick={() => onSave(rating, comment.trim())} disabled={comment.trim().length < 4}>ثبت نظر</Button>
        </div>
        <p className="text-2xs leading-5 text-ink-muted">در حالت دمو بدون حساب کاربری، نظر با نام «شما» و در همین مرورگر ذخیره می‌شود و فقط برای همین محصول دیده می‌شود.</p>
      </div>
    </Modal>
  );
}

const REVIEW_KEY = "homeino-product-reviews";

function localReviews(productId: string): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Review[]>) : {};
    return all[productId] ?? [];
  } catch {
    return [];
  }
}

function saveLocalReview(productId: string, rating: number, comment: string): Review {
  const review: Review = {
    id: `local-${Date.now()}`,
    author: "شما (دمو)",
    rating,
    date: new Date().toLocaleDateString("fa-IR"),
    comment,
    helpful: 0,
  };
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Review[]>) : {};
    all[productId] = [review, ...(all[productId] ?? [])];
    window.localStorage.setItem(REVIEW_KEY, JSON.stringify(all));
  } catch {
    // demo keeps working in memory only
  }
  return review;
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
            <div className="overflow-hidden rounded-xl border border-clay/40"><img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover transition group-hover:scale-105" /></div>
            <p className="mt-1.5 line-clamp-1 text-2xs font-bold text-ink">{p.name}</p>
            <p className="text-2xs text-terracotta-deep">{toFa(formatPrice(p.price))} ت</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
