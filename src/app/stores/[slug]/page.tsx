"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import {
  BadgeCheck, CheckCircle2, Clock3, Heart, MapPin, MessageCircle, Package,
  RotateCcw, ShieldCheck, Star, Truck,
} from "lucide-react";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { Button, Chip, LogoBlock, Rating, SelectField } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getStore } from "@/data/stores";
import { productsByStore } from "@/data/products";
import { categories } from "@/data/categories";
import { getStorefrontProfile, reviewsForStore } from "@/data/storefronts";
import { useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { cn, toFa } from "@/lib/utils";

type Tab = "products" | "categories" | "reviews" | "shipping" | "policies";
const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "محصولات" },
  { id: "categories", label: "دسته‌بندی‌ها" },
  { id: "reviews", label: "نظر کاربران" },
  { id: "shipping", label: "ارسال" },
  { id: "policies", label: "قوانین فروشگاه" },
];

export default function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const store = getStore(slug);
  if (!store) notFound();

  const products = productsByStore(store.id);
  const profile = getStorefrontProfile(store.id);
  const reviews = reviewsForStore(store.id);
  const [tab, setTab] = useState<Tab>("products");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const wishlist = useWishlist();
  const toast = useUi((state) => state.toast);
  const followed = wishlist.stores.includes(store.id);

  const storeCategories = categories.filter((item) => store.categorySlugs.includes(item.slug) || products.some((product) => product.categorySlug === item.slug));
  const filteredProducts = category === "all" ? products : products.filter((product) => product.categorySlug === category);
  const list = [...filteredProducts].sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "new" ? Number(b.isNew) - Number(a.isNew) : b.rating - a.rating);

  return (
    <Container className="py-7 sm:py-9">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "فروشگاه‌ها", href: "/stores" }, { label: store.name }]} />

      <Reveal>
        <section className="mt-5 overflow-hidden rounded-[var(--radius-xl)] border border-clay/30 bg-cream shadow-[var(--shadow-soft)]">
          <div className="relative h-48 overflow-hidden sm:h-64 lg:h-72">
            <SmartImage src={store.cover} alt={`بنر فروشگاه ${store.name}`} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/82 via-ink/15 to-transparent" />
            <div className="absolute bottom-4 right-4 hidden max-w-xl text-cream sm:block"><div className="text-xs text-gold-soft">ویترین رسمی فروشگاه</div><h1 className="mt-1 text-3xl font-black text-cream">{store.name}</h1><p className="mt-1 line-clamp-2 text-sm text-cream/70">{store.description}</p></div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="-mt-12 shrink-0 rounded-2xl border-4 border-cream bg-cream p-1 shadow-[var(--shadow-card)] sm:-mt-16"><LogoBlock char={store.logo} color={store.logoColor} size={72} /></div>
                <div className="min-w-0 sm:hidden"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black text-ink">{store.name}</h1>{store.verified && <BadgeCheck size={18} className="text-success" />}</div><p className="mt-1 line-clamp-2 text-xs leading-6 text-ink-muted">{store.description}</p></div>
                <div className="hidden min-w-0 sm:block"><div className="flex flex-wrap items-center gap-2">{store.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success"><BadgeCheck size={14} /> فروشگاه تأییدشده</span> : <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-bold text-warning">تأیید در حال تکمیل</span>}<span className="text-xs text-ink-muted">عضو Homeino از {profile?.joinedAt ?? "—"}</span></div><p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">{store.description}</p></div>
              </div>
              <Button variant={followed ? "primary" : "outline"} onClick={() => { wishlist.toggleStore(store.id); toast(followed ? "دنبال‌کردن فروشگاه لغو شد" : "فروشگاه را دنبال می‌کنی"); }}><Heart size={16} className={cn(followed && "fill-current")} />{followed ? "دنبال می‌کنی" : "دنبال کردن"}</Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-clay/30 pt-5 sm:grid-cols-3 lg:grid-cols-6">
              <StoreStat icon={<Star size={15} className="fill-gold text-gold" />} value={toFa(store.rating.toFixed(1))} label={`${toFa(store.reviewsCount)} نظر`} />
              <StoreStat icon={<Package size={15} />} value={toFa(store.productCount)} label="محصول" />
              <StoreStat icon={<CheckCircle2 size={15} />} value={toFa(profile?.fulfilledOrders ?? 0)} label="سفارش موفق" />
              <StoreStat icon={<MessageCircle size={15} />} value={`${toFa(profile?.responseRate ?? 0)}٪`} label="نرخ پاسخ‌گویی" />
              <StoreStat icon={<Clock3 size={15} />} value={profile?.dispatchTime ?? "—"} label="آماده‌سازی" />
              <StoreStat icon={<MapPin size={15} />} value={store.city} label="محل فروشگاه" />
            </div>
          </div>
        </section>
      </Reveal>

      <div className="sticky top-[6.9rem] z-20 mt-6 border-y border-clay/35 glass lg:top-[7.1rem]">
        <div role="tablist" aria-label="بخش‌های فروشگاه" className="hide-scrollbar flex overflow-x-auto">{TABS.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("relative min-h-12 shrink-0 px-4 text-sm font-bold", tab === item.id ? "text-ink" : "text-ink-muted hover:text-ink")}>{item.label}{item.id === "products" && <span className="mr-1 text-[10px]">({toFa(products.length)})</span>}{tab === item.id && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-terracotta" />}</button>)}</div>
      </div>

      <div className="py-7">
        {tab === "products" && <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1"><Chip active={category === "all"} onClick={() => setCategory("all")}>همه محصولات</Chip>{storeCategories.map((item) => <Chip key={item.slug} active={category === item.slug} onClick={() => setCategory(item.slug)}>{item.name}</Chip>)}</div><SelectField aria-label="مرتب‌سازی محصولات فروشگاه" value={sort} onChange={(event) => setSort(event.target.value)} options={[{ value: "popular", label: "محبوب‌ترین" }, { value: "new", label: "جدیدترین" }, { value: "price-asc", label: "کمترین قیمت" }]} className="min-w-36" /></div>
          <ProductGrid products={list} />
        </section>}

        {tab === "categories" && <section><div className="mb-5"><h2 className="text-2xl font-black text-ink">دسته‌بندی‌های فروشگاه</h2><p className="mt-1 text-sm text-ink-muted">مستقیم وارد بخش موردنظرت شو و جستجو را کوتاه کن.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{storeCategories.map((item) => { const count = products.filter((product) => product.categorySlug === item.slug).length; return <button key={item.slug} onClick={() => { setCategory(item.slug); setTab("products"); }} className="group relative min-h-44 overflow-hidden rounded-[var(--radius-lg)] text-right"><SmartImage src={item.image} alt={item.name} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" /><span className="absolute inset-x-0 bottom-0 p-4 text-cream"><span className="block text-lg font-black">{item.name}</span><span className="text-xs text-cream/65">{toFa(count)} محصول در این ویترین</span></span></button>; })}</div></section>}

        {tab === "reviews" && <section><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-ink">نظر خریداران فروشگاه</h2><p className="mt-1 text-sm text-ink-muted">فقط تجربه‌های دارای خرید ثبت‌شده با برچسب مشخص نمایش داده می‌شوند.</p></div><Rating value={store.rating} count={store.reviewsCount} /></div><div className="grid gap-4 lg:grid-cols-3">{reviews.map((review) => <article key={review.id} className="card-surface p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-ink">{review.author}</div>{review.verifiedPurchase && <div className="mt-1 flex items-center gap-1 text-[10px] text-success"><BadgeCheck size={11} /> خرید تأییدشده</div>}</div><div className="text-left"><Rating value={review.rating} /><div className="mt-1 text-[10px] text-ink-muted">{review.date}</div></div></div><p className="mt-3 text-sm leading-7 text-ink-muted">{review.comment}</p></article>)}</div></section>}

        {tab === "shipping" && <PolicySection title="ارسال و تحویل" description="پیش از پرداخت، زمان و هزینه دقیق هر محصول در همان صفحه و سبد خرید نمایش داده می‌شود." items={[{ icon: <Truck />, title: profile?.shippingCoverage ?? "پوشش ارسال", text: profile?.shippingNote ?? "جزئیات ارسال هر محصول را بررسی کنید." }, { icon: <Clock3 />, title: "زمان آماده‌سازی", text: profile?.dispatchTime ?? "در صفحه هر محصول اعلام می‌شود." }, { icon: <Package />, title: "مرسوله مستقل", text: "اگر از چند فروشگاه خرید کنی، هر فروشگاه مرسوله و کد پیگیری جدا خواهد داشت." }]} />}

        {tab === "policies" && <PolicySection title="سیاست‌ها و اعتماد" description="شرایط فروشگاه باید پیش از خرید روشن باشد؛ بدون تایمر، کمیابی ساختگی یا هزینه پنهان." items={[{ icon: <ShieldCheck />, title: store.verified ? "هویت تأییدشده" : "تأیید در حال تکمیل", text: profile?.authenticityNote ?? "وضعیت تأیید در بالای صفحه نمایش داده می‌شود." }, { icon: <RotateCcw />, title: `بازگشت تا ${toFa(profile?.returnDays ?? 7)} روز`, text: profile?.returnNote ?? "شرایط بازگشت بر اساس وضعیت کالا بررسی می‌شود." }, { icon: <MessageCircle />, title: "پاسخ‌گویی فروشگاه", text: `${profile?.responseTime ?? "همان روز کاری"} · نرخ پاسخ‌گویی ${toFa(profile?.responseRate ?? 0)}٪` }]} />}
      </div>
    </Container>
  );
}

function StoreStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-xl bg-ivory-2/55 p-3 text-center"><span className="mb-1 flex items-center justify-center gap-1 text-sm font-black text-ink">{icon}{value}</span><span className="text-[10px] text-ink-muted">{label}</span></div>;
}

function PolicySection({ title, description, items }: { title: string; description: string; items: { icon: React.ReactNode; title: string; text: string }[] }) {
  return <section><div className="mb-6 max-w-2xl"><h2 className="text-2xl font-black text-ink">{title}</h2><p className="mt-2 text-sm leading-7 text-ink-muted">{description}</p></div><div className="grid gap-4 md:grid-cols-3">{items.map((item) => <article key={item.title} className="card-surface p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-success/10 text-success [&_svg]:h-5 [&_svg]:w-5">{item.icon}</span><h3 className="mt-4 text-base font-black text-ink">{item.title}</h3><p className="mt-2 text-sm leading-7 text-ink-muted">{item.text}</p></article>)}</div><div className="mt-5 rounded-xl border border-info/20 bg-info/7 p-4 text-xs leading-6 text-info">این صفحه برای معماری چندفروشگاهی آماده شده است. اطلاعات فعلی نمونه رابط کاربری است و پس از آنبورد فروشگاه واقعی از پروفایل فروشنده دریافت می‌شود.</div></section>;
}
