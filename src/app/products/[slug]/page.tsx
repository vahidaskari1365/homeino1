"use client";

import { use, useEffect, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, Check, ChevronLeft, GitCompare, Heart, MessageCircle, Minus,
  PackageCheck, Plus, RotateCcw, Ruler, ShieldCheck, ShoppingBag, Sparkles,
  Star, Truck, WalletCards, Wand2,
} from "lucide-react";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { Button, Badge, Rating, Price, LogoBlock } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { CollectionPicker } from "@/components/CollectionPicker";
import { Reveal } from "@/components/motion/Reveal";
import { getProduct, getProductById, products } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { getStorefrontProfile } from "@/data/storefronts";
import { offersForProduct, getBestOffer } from "@/data/offers";
import { sampleReviews } from "@/data/inspirations";
import { PLATFORM } from "@/config/platform";
import { useCart, useWishlist, useCompare, useRecentlyViewed } from "@/stores/useShop";
import { useUi, useChat } from "@/stores/useApp";
import { toFa, formatPrice, cn } from "@/lib/utils";

const STYLE_LABELS: Record<string, string> = {
  modern: "مدرن", minimal: "مینیمال", scandinavian: "اسکاندیناوی", japandi: "ژاپندی",
  classic: "کلاسیک", contemporary: "معاصر", industrial: "صنعتی", boho: "بوهو",
  luxury: "لوکس", rustic: "روستیک",
};

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const product = getProduct(slug);
  if (!product) notFound();

  const availableOffers = useMemo(
    () => offersForProduct(product.id).filter((offer) => offer.inStock).sort((a, b) => (a.price + a.shippingCost) - (b.price + b.shippingCost)),
    [product.id],
  );
  const bestOffer = getBestOffer(product.id);
  const [selectedOfferId, setSelectedOfferId] = useState(bestOffer?.id);
  const selectedOffer = availableOffers.find((offer) => offer.id === selectedOfferId) ?? bestOffer ?? undefined;
  const selectedStore = getStoreById(selectedOffer?.storeId ?? product.storeId);
  const storeProfile = selectedStore ? getStorefrontProfile(selectedStore.id) : undefined;
  const displayPrice = selectedOffer?.price ?? product.price;
  const oldPrice = selectedOffer?.oldPrice ?? product.oldPrice;
  const stock = selectedOffer?.stock ?? product.stockCount;
  const inStock = selectedOffer ? selectedOffer.inStock : product.inStock;

  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews">("desc");
  const wishlist = useWishlist();
  const compare = useCompare();
  const addToCart = useCart((state) => state.add);
  const trackRecent = useRecentlyViewed((state) => state.track);
  const { toast, setAiPanel } = useUi();
  const chat = useChat();
  const router = useRouter();
  const wished = wishlist.products.includes(product.id);
  const compared = compare.has(product.id);

  useEffect(() => trackRecent(product.id), [product.id, trackRecent]);

  const similar = products
    .filter((item) => item.id !== product.id && item.categorySlug === product.categorySlug)
    .sort((a, b) => Number(b.styleSlugs.some((style) => product.styleSlugs.includes(style))) - Number(a.styleSlugs.some((style) => product.styleSlugs.includes(style))))
    .slice(0, 4);
  const complements = products
    .filter((item) => item.id !== product.id && item.categorySlug !== product.categorySlug && item.styleSlugs.some((style) => product.styleSlugs.includes(style)) && item.inStock)
    .slice(0, 4);

  const addSelectedToCart = () => {
    addToCart(product.id, qty, selectedOffer?.id);
    toast(`از ${selectedStore?.name ?? product.brand} به سبد خرید اضافه شد`);
  };

  const askAi = (prompt: string) => {
    chat.push({ role: "user", content: `${prompt} — ${product.name}` });
    setAiPanel(true);
  };

  return (
    <Container className="py-7 sm:py-9">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "محصولات", href: "/products" }, { label: product.name }]} />

      <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1.03fr)_minmax(390px,.97fr)] lg:gap-10">
        <Reveal>
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-clay/30 bg-ivory-2">
              <SmartImage src={product.images[activeImage]} alt={`${product.name}، تصویر ${toFa(activeImage + 1)}`} className="aspect-square w-full" />
              <div className="absolute right-3 top-3 flex flex-col items-start gap-1.5">
                {oldPrice && oldPrice > displayPrice && <Badge tone="accent">{toFa(Math.round(((oldPrice - displayPrice) / oldPrice) * 100))}٪ تخفیف</Badge>}
                {product.isNew && <Badge tone="dark">محصول جدید</Badge>}
              </div>
            </div>
            {product.images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{product.images.map((image, index) => <button key={image + index} onClick={() => setActiveImage(index)} aria-label={`نمایش تصویر ${toFa(index + 1)}`} aria-pressed={activeImage === index} className={cn("h-18 w-18 shrink-0 overflow-hidden rounded-xl border-2 p-0.5 transition sm:h-20 sm:w-20", activeImage === index ? "border-ink" : "border-transparent opacity-65 hover:opacity-100")}><SmartImage src={image} alt="" className="h-full w-full rounded-lg" /></button>)}</div>}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-clay/35 bg-cream p-3 text-center text-[11px] text-ink-muted">
              <span className="flex flex-col items-center gap-1"><ShieldCheck size={17} className="text-success" /> پرداخت امن</span>
              <span className="flex flex-col items-center gap-1"><RotateCcw size={17} className="text-success" /> {toFa(PLATFORM.policies.returnDays)} روز بازگشت</span>
              <span className="flex flex-col items-center gap-1"><Truck size={17} className="text-success" /> ارسال قابل پیگیری</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <section aria-labelledby="product-title">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
              <Link href={`/category/${product.categorySlug}`} className="font-bold text-terracotta-deep hover:underline">{product.brand}</Link>
              <span aria-hidden="true">•</span>
              <a href="#reviews" onClick={() => setTab("reviews")} className="hover:text-ink"><Rating value={product.rating} count={product.reviewsCount} /></a>
              <span aria-hidden="true">•</span>
              <span>{toFa(product.purchaseCount)} خرید ثبت‌شده</span>
            </div>
            <h1 id="product-title" className="mt-2 text-balance text-2xl font-black text-ink sm:text-3xl">{product.name}</h1>
            <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-muted">{product.description}</p>

            <div className="mt-5 rounded-[var(--radius-lg)] border border-clay/40 bg-cream p-4 shadow-[var(--shadow-soft)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="mb-1 text-[11px] text-ink-muted">قیمت فروشنده انتخاب‌شده</div><Price price={displayPrice} oldPrice={oldPrice} /></div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", inStock ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}><PackageCheck size={14} />{inStock ? `موجود · ${toFa(stock)} عدد` : "ناموجود"}</span>
              </div>

              {availableOffers.length > 1 && (
                <fieldset className="mt-5 border-t border-clay/35 pt-4">
                  <legend className="mb-1 text-sm font-black text-ink">فروشنده را انتخاب کن</legend>
                  <p className="mb-3 text-[11px] leading-5 text-ink-muted">قیمت، اعتبار فروشگاه و زمان ارسال را شفاف مقایسه کن. ترتیب بر اساس مبلغ کالا و ارسال است.</p>
                  <div className="space-y-2">
                    {availableOffers.map((offer, index) => {
                      const offerStore = getStoreById(offer.storeId);
                      const selected = selectedOffer?.id === offer.id;
                      const total = offer.price + offer.shippingCost;
                      return (
                        <label key={offer.id} className={cn("block cursor-pointer rounded-xl border p-3 transition", selected ? "border-terracotta bg-terracotta/5 shadow-sm" : "border-clay/35 hover:border-terracotta/45")}>
                          <input type="radio" name="seller" value={offer.id} checked={selected} onChange={() => { setSelectedOfferId(offer.id); setQty((current) => Math.min(current, Math.max(offer.stock, 1))); }} className="sr-only" />
                          <span className="flex items-start gap-3">
                            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", selected ? "border-terracotta bg-terracotta text-white" : "border-clay")}><Check size={12} className={cn(!selected && "opacity-0")} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5 text-xs font-black text-ink">{offerStore?.name}{offerStore?.verified && <BadgeCheck size={14} className="text-success" />}{index === 0 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[9px] text-success">کمترین مبلغ نهایی</span>}</span>
                              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-muted"><span><Star size={10} className="inline fill-gold text-gold" /> {toFa(offerStore?.rating.toFixed(1) ?? "—")}</span><span><Truck size={10} className="inline" /> {offer.shippingDays}</span><span>{offer.shippingCost === 0 ? "ارسال رایگان" : `ارسال ${toFa(formatPrice(offer.shippingCost))} تومان`}</span><span>{toFa(offer.stock)} عدد موجود</span></span>
                            </span>
                            <span className="shrink-0 text-left"><span className="block text-xs font-black text-ink">{toFa(formatPrice(offer.price))} ت</span><span className="text-[9px] text-ink-muted">نهایی {toFa(formatPrice(total))} ت</span></span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {selectedStore && (
                <div className="mt-4 rounded-xl bg-ivory-2/75 p-3">
                  <div className="flex items-center gap-3">
                    <LogoBlock char={selectedStore.logo} color={selectedStore.logoColor} size={42} />
                    <div className="min-w-0 flex-1"><Link href={`/stores/${selectedStore.slug}`} className="flex items-center gap-1 text-sm font-black text-ink hover:text-terracotta-deep">{selectedStore.name}{selectedStore.verified && <BadgeCheck size={15} className="text-success" />}</Link><div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-ink-muted"><span>امتیاز {toFa(selectedStore.rating.toFixed(1))} از {toFa(selectedStore.reviewsCount)} نظر</span>{storeProfile && <span>{toFa(storeProfile.fulfilledOrders)} سفارش موفق</span>}</div></div>
                    <Link href={`/stores/${selectedStore.slug}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta-deep">صفحه فروشگاه <ChevronLeft size={13} /></Link>
                  </div>
                  <div className="mt-3 grid gap-2 border-t border-clay/30 pt-3 text-[10px] text-ink-muted sm:grid-cols-3"><span className="flex items-center gap-1"><Truck size={12} /> {selectedOffer?.shippingDays ?? storeProfile?.dispatchTime ?? "اعلام پس از سفارش"}</span><span className="flex items-center gap-1"><RotateCcw size={12} /> بازگشت تا {toFa(storeProfile?.returnDays ?? PLATFORM.policies.returnDays)} روز</span><span className="flex items-center gap-1"><ShieldCheck size={12} /> {selectedStore.verified ? "هویت تأیید شده" : "در حال تکمیل تأیید"}</span></div>
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 text-xs font-bold text-ink">رنگ انتخابی: <span className="font-normal text-ink-muted">{product.colors[0]?.name}</span></div>
                <div className="flex flex-wrap gap-2">{product.colors.map((color, index) => <button key={color.name} type="button" aria-label={`انتخاب رنگ ${color.name}`} title={color.name} className={cn("h-8 w-8 rounded-full border-2", index === 0 ? "border-ink ring-2 ring-clay/40 ring-offset-2 ring-offset-cream" : "border-clay/50")} style={{ background: color.hex }} />)}</div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <div className="flex h-12 items-center rounded-xl border border-clay/55 bg-cream p-1">
                  <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="کاهش تعداد" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-ivory-2"><Minus size={15} /></button>
                  <span className="w-8 text-center text-sm font-black">{toFa(qty)}</span>
                  <button type="button" onClick={() => setQty((value) => Math.min(Math.max(stock, 1), value + 1))} aria-label="افزایش تعداد" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-ivory-2"><Plus size={15} /></button>
                </div>
                <Button size="lg" className="flex-1" disabled={!inStock} onClick={addSelectedToCart}><ShoppingBag size={18} /> {inStock ? "افزودن به سبد خرید" : "در حال حاضر ناموجود"}</Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => { wishlist.toggleProduct(product.id); toast(wished ? "از علاقه‌مندی حذف شد" : "به علاقه‌مندی اضافه شد"); }} aria-pressed={wished} className={cn(wished && "border-terracotta text-terracotta-deep")}><Heart size={16} className={cn(wished && "fill-current")} /><span className="hidden sm:inline">علاقه‌مندی</span></Button>
                <CollectionPicker productId={product.id} compact />
                <Button variant="outline" size="sm" onClick={() => { compare.toggle(product.id); toast(compared ? "از مقایسه حذف شد" : "به مقایسه اضافه شد"); }} aria-pressed={compared} className={cn(compared && "border-terracotta text-terracotta-deep")}><GitCompare size={16} /><span className="hidden sm:inline">مقایسه</span></Button>
              </div>

              <div className="mt-4 grid gap-2 border-t border-clay/35 pt-4 text-xs text-ink-muted sm:grid-cols-2">
                {PLATFORM.policies.securePayment && <span className="flex items-center gap-2"><WalletCards size={15} className="text-success" /> پرداخت امن و قابل پیگیری</span>}
                {PLATFORM.policies.authenticityGuarantee && <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-success" /> ضمانت اصالت مطابق سیاست فروشگاه</span>}
                <span className="flex items-center gap-2"><Truck size={15} className="text-success" /> {selectedOffer?.shippingCost === 0 ? "ارسال رایگان این فروشنده" : "هزینه ارسال پیش از پرداخت روشن است"}</span>
                <span className="flex items-center gap-2"><RotateCcw size={15} className="text-success" /> شرایط بازگشت شفاف و قابل مشاهده</span>
              </div>
            </div>
          </section>
        </Reveal>
      </div>

      <section className="mt-10 rounded-[var(--radius-lg)] border border-gold/25 bg-gradient-to-l from-gold/8 to-cream p-4 sm:p-5" aria-labelledby="ai-helper-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl"><div className="mb-1 flex items-center gap-2 text-xs font-bold text-[#80601f]"><Sparkles size={15} /> قابلیت اختیاری Homeino AI</div><h2 id="ai-helper-title" className="text-lg font-black text-ink">قبل از خرید، هماهنگی این محصول را بررسی کن</h2><p className="mt-1 text-xs leading-6 text-ink-muted">این ابزار بخشی از پلتفرم است؛ برای کشف و خرید محصول نیازی به استفاده از AI نداری. اتصال خودکار محصولات مشابه به طراحی‌ها در نسخه‌های بعد تکمیل می‌شود.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => askAi("این محصول با چه رنگ‌ها و محصولاتی هماهنگ است؟")}><MessageCircle size={16} /> پرسش درباره هماهنگی</Button><Button variant="gold" onClick={() => router.push(`/ai/design?tab=inspiration&product=${product.slug}`)}><Wand2 size={16} /> دیدن در فضای من</Button></div>
        </div>
      </section>

      <section id="product-details" className="mt-12">
        <div role="tablist" aria-label="اطلاعات محصول" className="hide-scrollbar flex gap-1 overflow-x-auto border-b border-clay/40">
          {([['desc', 'توضیحات محصول'], ['specs', 'مشخصات و ابعاد'], ['reviews', `نظر کاربران (${toFa(product.reviewsCount)})`]] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key} className={cn("relative min-h-12 shrink-0 px-4 text-sm font-bold", tab === key ? "text-ink" : "text-ink-muted")}>{label}{tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-terracotta" />}</button>)}
        </div>
        <div className="py-6">
          {tab === "desc" && <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><p className="max-w-3xl text-sm leading-8 text-ink-muted">{product.description}</p><div className="rounded-xl border border-clay/35 bg-cream p-4"><h3 className="text-sm font-black text-ink">مناسب چه فضایی است؟</h3><div className="mt-3 flex flex-wrap gap-2">{product.styleSlugs.map((style) => <Link key={style} href={`/styles/${style}`} className="rounded-full bg-ivory-2 px-3 py-1.5 text-xs font-bold text-ink">{STYLE_LABELS[style] ?? style}</Link>)}</div>{product.dimensions && <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted"><Ruler size={14} /> {product.dimensions}</p>}</div></div>}
          {tab === "specs" && <div className="max-w-2xl divide-y divide-clay/35 overflow-hidden rounded-xl border border-clay/40 bg-cream">{[...product.specs, { label: "ابعاد", value: product.dimensions ?? "ثبت نشده" }, { label: "جنس", value: product.materials.join("، ") }].map((spec) => <div key={spec.label} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3 text-sm"><span className="text-ink-muted">{spec.label}</span><span className="font-bold text-ink">{spec.value}</span></div>)}</div>}
          {tab === "reviews" && <div id="reviews" className="grid gap-5 lg:grid-cols-[260px_1fr]"><div className="card-surface h-fit p-5 text-center"><div className="text-4xl font-black text-ink">{toFa(product.rating.toFixed(1))}</div><div className="mt-2 flex justify-center"><Rating value={product.rating} /></div><p className="mt-1 text-xs text-ink-muted">بر اساس {toFa(product.reviewsCount)} نظر</p><Button variant="outline" className="mt-4 w-full" onClick={() => toast("ثبت نظر پس از اتصال حساب خرید فعال می‌شود", "info")}>ثبت نظر</Button></div><div className="space-y-3">{sampleReviews.map((review) => <article key={review.id} className="card-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><LogoBlock char={review.author[0]} color="#456653" size={36} /><div><div className="text-sm font-black text-ink">{review.author}</div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-success"><BadgeCheck size={11} /> خریدار این محصول</div></div></div><div className="text-left"><Rating value={review.rating} /><div className="mt-1 text-[10px] text-ink-muted">{review.date}</div></div></div><p className="mt-3 text-sm leading-7 text-ink-muted">{review.comment}</p></article>)}</div></div>}
        </div>
      </section>

      {similar.length > 0 && <section className="mt-10"><div className="mb-5"><div className="text-xs font-bold text-terracotta-deep">برای مقایسه بهتر</div><h2 className="mt-1 text-2xl font-black text-ink">محصولات مشابه</h2><p className="mt-1 text-sm text-ink-muted">محصولات هم‌دسته با سبک یا کاربرد نزدیک.</p></div><ProductGrid products={similar} /></section>}
      {complements.length > 0 && <section className="mt-12 rounded-[var(--radius-xl)] border border-clay/35 bg-cream/60 p-4 sm:p-6"><div className="mb-5"><div className="text-xs font-bold text-terracotta-deep">تکمیل چیدمان</div><h2 className="mt-1 text-2xl font-black text-ink">محصولات مرتبط</h2><p className="mt-1 text-sm text-ink-muted">بر اساس سبک‌های مشترک، نه تبلیغ یا فشار خرید.</p></div><ProductGrid products={complements} /></section>}

      {inStock && <div className="fixed inset-x-0 bottom-[4.25rem] z-30 flex items-center gap-2 border-t border-clay/40 glass px-3 py-2.5 lg:hidden"><div className="min-w-0 flex-1"><p className="truncate text-[9px] text-ink-muted">{selectedStore?.name}</p><p className="text-sm font-black text-ink">{toFa(formatPrice(displayPrice))} <span className="text-[9px] font-normal">تومان</span></p></div><button onClick={addSelectedToCart} className="btn-primary flex min-h-11 items-center gap-1.5 rounded-xl px-5 text-xs font-bold"><ShoppingBag size={15} /> افزودن به سبد</button></div>}

      <RecentlyViewedSection currentId={product.id} />
    </Container>
  );
}

function RecentlyViewedSection({ currentId }: { currentId: string }) {
  const recentIds = useRecentlyViewed((state) => state.productIds);
  const recent = recentIds.map(getProductById).filter((item) => item && item.id !== currentId).slice(0, 6);
  if (!recent.length) return null;
  return <section className="mt-12 border-t border-clay/35 pt-8"><h2 className="mb-4 text-lg font-black text-ink">اخیراً دیده‌شده</h2><div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">{recent.map((item) => item && <Link key={item.id} href={`/products/${item.slug}`} className="group w-36 shrink-0"><div className="overflow-hidden rounded-xl border border-clay/40"><SmartImage src={item.images[0]} alt={item.name} className="aspect-square w-full transition group-hover:scale-105" /></div><p className="mt-2 line-clamp-2 text-xs font-bold text-ink">{item.name}</p><p className="mt-1 text-[11px] text-terracotta-deep">{toFa(formatPrice(item.price))} تومان</p></Link>)}</div></section>;
}
