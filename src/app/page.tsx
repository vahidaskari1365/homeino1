"use client";

import Link from "next/link";
import {
  ArrowLeft, BadgeCheck, Boxes, FolderHeart, GitCompare, HeartHandshake,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, Store, Truck, Wand2,
} from "lucide-react";
import { Container, Badge, ButtonLink, SectionHeading } from "@/components/ui/primitives";
import { ProductCard, StoreCard, InspirationCard } from "@/components/cards";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { Hero } from "@/components/home/Hero";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { stores, collections } from "@/data/stores";
import { products, getProductById } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { SmartImage } from "@/components/ui/SmartImage";
import { useRecentlyViewed } from "@/stores/useShop";
import { toFa } from "@/lib/utils";

const popularProducts = [...products].sort((a, b) => b.purchaseCount - a.purchaseCount).slice(0, 4);
const trendingProducts = products.filter((product) => product.trending).slice(0, 4);

export default function HomePage() {
  const recentIds = useRecentlyViewed((state) => state.productIds);
  const recent = recentIds.map(getProductById).filter(Boolean).slice(0, 4);

  return (
    <>
      <Hero />

      <section className="border-y border-gold/15 bg-cream py-4">
        <Container>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4">
            {[
              [ShieldCheck, "پرداخت امن", "فرایند روشن و قابل پیگیری"],
              [BadgeCheck, "فروشگاه شفاف", "هویت و امتیاز قابل مشاهده"],
              [Truck, "ارسال مشخص", "زمان و هزینه پیش از پرداخت"],
              [HeartHandshake, "بازگشت روشن", "شرایط هر فروشنده کنار محصول"],
            ].map(([Icon, title, description]) => <div key={title as string} className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/9 text-success"><Icon size={17} /></span><span><b className="block text-xs text-ink sm:text-sm">{title as string}</b><span className="hidden text-[10px] text-ink-muted sm:block">{description as string}</span></span></div>)}
          </div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="کشف سریع" title="از کدام بخش خانه شروع می‌کنی؟" desc="بدون جستجوی طولانی، مستقیم وارد دسته موردنیازت شو." action={<Link href="/products" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه محصولات <ArrowLeft size={16} /></Link>} /></Reveal>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 6).map((category) => <RevealItem key={category.id}><Link href={`/category/${category.slug}`} className="group card-surface card-interactive block h-full overflow-hidden"><div className="relative aspect-[4/3] overflow-hidden"><SmartImage src={category.image} alt={category.name} className="h-full w-full transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/65 to-transparent" /><span className="absolute bottom-2 right-2 rounded-full bg-cream/92 px-2 py-1 text-[10px] font-bold text-ink">{toFa(category.productCount)} محصول</span></div><div className="p-3"><h3 className="text-sm font-black text-ink sm:text-base">{category.name}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-muted">{category.description}</p></div></Link></RevealItem>)}
          </RevealGroup>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link href="/products" className="flex items-center gap-3 rounded-2xl border border-clay/35 bg-cream p-4 transition hover:border-terracotta/45"><SlidersHorizontal size={20} className="text-terracotta" /><span><b className="block text-sm text-ink">فیلتر دقیق</b><span className="text-xs text-ink-muted">قیمت، رنگ، سبک و فروشگاه</span></span></Link>
            <Link href="/compare" className="flex items-center gap-3 rounded-2xl border border-clay/35 bg-cream p-4 transition hover:border-terracotta/45"><GitCompare size={20} className="text-terracotta" /><span><b className="block text-sm text-ink">مقایسه روشن</b><span className="text-xs text-ink-muted">قیمت، فروشنده، ارسال و مشخصات</span></span></Link>
            <Link href="/search" className="flex items-center gap-3 rounded-2xl border border-clay/35 bg-cream p-4 transition hover:border-terracotta/45"><Search size={20} className="text-terracotta" /><span><b className="block text-sm text-ink">جستجوی یکپارچه</b><span className="text-xs text-ink-muted">محصول، دسته، سبک یا فروشگاه</span></span></Link>
          </div>
        </Container>
      </section>

      <section className="section-space-sm border-y border-clay/25 bg-cream/42">
        <Container>
          <Reveal><SectionHeading eyebrow="محبوب میان خریداران" title="انتخاب‌های پرطرفدار خانه" desc="مرتب‌شده بر اساس خریدهای ثبت‌شده در داده محصول؛ با قیمت، امتیاز، فروشگاه و ارسال روشن." action={<Link href="/products?sort=popular" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">مشاهده بیشتر <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{popularProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          <div className="mb-5 mt-12 flex flex-wrap items-end justify-between gap-3 border-t border-clay/30 pt-8"><div><div className="text-xs font-bold text-terracotta-deep">ترند این هفته</div><h3 className="mt-1 text-xl font-black text-ink">محصولاتی که بیشتر دیده می‌شوند</h3></div><Link href="/products" className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-deep">کشف بیشتر <ArrowLeft size={14} /></Link></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{trendingProducts.map((product) => <ProductCard key={`trending-${product.id}`} product={product} />)}</div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="بازارگاه چندفروشگاهی" title="فروشگاه را قبل از محصول بشناس" desc="هویت، سابقه، امتیاز، نظر خریداران، ارسال و سیاست بازگشت هر فروشگاه در یک ویترین مستقل." action={<Link href="/stores" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه فروشگاه‌ها <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stores.filter((store) => store.verified).slice(0, 4).map((store) => <StoreCard key={store.id} store={store} />)}</div>
          <div className="mt-6 rounded-2xl border border-success/20 bg-success/6 p-4 text-xs leading-6 text-success"><BadgeCheck size={15} className="ml-1 inline" /> برچسب «تأییدشده» فقط برای فروشگاه‌هایی نمایش داده می‌شود که وضعیت تأییدشان در داده فروشگاه ثبت شده باشد.</div>
        </Container>
      </section>

      <section className="section-space-sm bg-ink text-cream">
        <Container>
          <Reveal><SectionHeading inverse eyebrow="از دیدن تا پیدا کردن" title="فضاهای واقعی، محصولات قابل کشف" desc="از چیدمان‌ها ایده بگیر، محصولات داخل هر فضا را ببین و گزینه‌های مشابه را پیدا کن." action={<Link href="/inspiration" className="inline-flex items-center gap-1 text-sm font-bold text-gold-soft">گالری الهام <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{inspirations.slice(0, 7).map((inspiration, index) => <div key={inspiration.id} className={index === 0 ? "col-span-2 row-span-2" : ""}><InspirationCard insp={inspiration} index={index} /></div>)}</div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <Badge tone="gold"><FolderHeart size={13} /> برنامه‌ریزی شخصی</Badge>
              <h2 className="mt-4 text-3xl font-black text-ink">برای هر اتاق، یک کالکشن بساز.</h2>
              <p className="mt-3 max-w-xl text-sm leading-8 text-ink-muted">محصولات علاقه‌مندی را در مجموعه‌های جدا مثل «پذیرایی جدید»، «اتاق کار» یا «خرید زیر ۲۰ میلیون» نگه دار؛ بعد کنار هم ببین و مقایسه کن.</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row"><ButtonLink href="/collections"><FolderHeart size={17} /> ساخت کالکشن من</ButtonLink><ButtonLink href="/wishlist" variant="outline">مشاهده ذخیره‌ها</ButtonLink></div>
            </div>
            <div className="grid grid-cols-2 gap-3">{collections.slice(0, 4).map((collection) => <Link key={collection.id} href="/inspiration" className="group relative min-h-40 overflow-hidden rounded-2xl"><SmartImage src={collection.image} alt={collection.title} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-3 text-cream"><b className="text-sm">{collection.title}</b><p className="text-[10px] text-cream/65">{collection.subtitle}</p></div></Link>)}</div>
          </div>
        </Container>
      </section>

      <section className="section-space-sm border-y border-gold/20 bg-gold/6">
        <Container>
          <div className="grid gap-6 overflow-hidden rounded-[var(--radius-xl)] border border-gold/25 bg-cream p-5 shadow-[var(--shadow-soft)] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-bold text-[#80601f]"><Sparkles size={15} /> یکی از قابلیت‌های Homeino</div><h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">فضای خودت را با AI پیش‌نمایش کن.</h2><p className="mt-2 text-sm leading-7 text-ink-muted">عکس فضا را بارگذاری کن و یک مسیر طراحی پیشنهادی ببین. خرید، جستجو و مقایسه مستقل از AI کار می‌کنند؛ اتصال مستقیم محصولات مرتبط با طراحی در نسخه‌های بعد تکمیل می‌شود.</p></div>
            <ButtonLink href="/ai/design" variant="gold" size="lg"><Wand2 size={18} /> شروع طراحی اختیاری</ButtonLink>
          </div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="زبان طراحی تو" title="کشف بر اساس سبک" desc="اگر اسم محصول را نمی‌دانی، از حال‌وهوای موردعلاقه‌ات شروع کن." action={<Link href="/styles" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه سبک‌ها <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">{styles.slice(0, 8).map((style) => <Link key={style.slug} href={`/styles/${style.slug}`} className="group relative h-52 w-48 shrink-0 overflow-hidden rounded-2xl sm:w-56"><SmartImage src={style.image} alt={style.name} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-cream"><h3 className="text-base font-black text-cream">{style.name}</h3><p className="mt-1 text-[11px] text-cream/65">{style.tagline}</p></div></Link>)}</div>
        </Container>
      </section>

      {recent.length > 0 && <section className="pb-16"><Container><SectionHeading eyebrow="ادامه مسیر" title="اخیراً دیده‌ای" desc="بدون جستجوی دوباره به انتخاب‌های قبلی برگرد." /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{recent.map((product) => product && <ProductCard key={product.id} product={product} />)}</div></Container></section>}

      <section className="pb-8 sm:pb-12"><Container><div className="overflow-hidden rounded-[var(--radius-xl)] surface-emerald p-6 text-cream shadow-[var(--shadow-card)] sm:p-9"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-gold-soft"><Boxes size={15} /> انتخاب روشن، بدون فشار مصنوعی</div><h2 className="text-2xl font-black text-cream sm:text-3xl">خانه‌ات را قدم‌به‌قدم کامل کن.</h2><p className="mt-2 text-sm text-cream/65">کشف کن، ذخیره کن، مقایسه کن و وقتی آماده بودی خرید را انجام بده.</p></div><div className="flex flex-col gap-2 sm:flex-row"><ButtonLink href="/products" variant="gold" size="lg"><Search size={17} /> کشف محصولات</ButtonLink><ButtonLink href="/stores" variant="ghost" size="lg" className="border-white/20 text-cream hover:bg-white/10 hover:text-cream"><Store size={17} /> یافتن فروشگاه</ButtonLink></div></div></div></Container></section>
    </>
  );
}
