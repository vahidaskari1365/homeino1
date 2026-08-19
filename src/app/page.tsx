"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft, BadgeCheck, ChevronDown, HeartHandshake, Lightbulb, Play,
  Search, ShieldCheck, Sparkles, Store, Truck, Users, Wand2,
} from "lucide-react";
import { Container, Badge, ButtonLink, Rating, SectionHeading } from "@/components/ui/primitives";
import { ProductCard, StoreCard, InspirationCard } from "@/components/cards";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { stores, collections } from "@/data/stores";
import { trendingProducts, products } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { IMG } from "@/data/media";
import { SmartImage } from "@/components/ui/SmartImage";
import { toFa } from "@/lib/utils";

const HERO_VIDEO = "/video/01.mp4";

export default function HomePage() {
  const { setSearch } = useUi();
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBackground = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.78], [1, 0]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const play = () => video.play().catch(() => undefined);
    play();
    video.addEventListener("canplay", play, { once: true });
    return () => video.removeEventListener("canplay", play);
  }, []);

  return (
    <>
      <section ref={heroRef} className="relative min-h-[76svh] w-full overflow-hidden bg-ink sm:min-h-[720px] lg:min-h-[calc(100svh-6rem)]">
        <motion.div style={{ y: yBackground }} className="absolute -inset-y-[8%] inset-x-0">
          {videoUnavailable ? (
            <SmartImage src={IMG.living5} alt="فضای داخلی گرم و مدرن" className="h-full w-full" />
          ) : (
            <video ref={videoRef} src={HERO_VIDEO} autoPlay muted loop playsInline preload="metadata" poster={IMG.living5} onError={() => setVideoUnavailable(true)} className="h-full w-full object-cover" aria-hidden="true" />
          )}
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-l from-ink/92 via-ink/64 to-ink/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/28" />
        <div className="grain absolute inset-0 opacity-45" />
        <div className="pointer-events-none absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-terracotta/28 blur-[100px] sm:h-[50vh] sm:w-[50vh]" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-gold/15 blur-[100px]" />

        <motion.div style={{ opacity: contentOpacity }} className="relative z-10 flex min-h-[76svh] items-center py-14 sm:min-h-[720px] lg:min-h-[calc(100svh-6rem)]">
          <Container>
            <div className="max-w-3xl">
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
                <Badge tone="dark" className="mb-5 border-gold/35 bg-white/10 px-3.5 py-2 text-gold-soft backdrop-blur"><Sparkles size={13} /> بازارگاه خانه و طراحی هوشمند</Badge>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 24, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.9, delay: 0.06 }} className="text-balance text-shadow-soft font-display text-[clamp(2.25rem,8vw,5rem)] font-black leading-[1.2] text-cream">
                خانه‌ای بساز که<br /><span className="text-gold-gradient">شبیه خودت</span> باشد.
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.18 }} className="mt-5 max-w-2xl text-pretty text-base leading-8 text-cream/78 sm:text-lg sm:leading-9">
                از کشف محصول و مقایسه فروشگاه‌ها تا الهام گرفتن و دیدن نتیجه در فضای واقعی با هوش مصنوعی؛ همه در یک تجربه ساده و مطمئن.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.28 }} className="mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <button onClick={() => setSearch(true)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/15 bg-cream/95 px-4 text-right text-ink shadow-[var(--shadow-lift)] backdrop-blur transition hover:bg-cream sm:px-5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-cream"><Search size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">دنبال چه چیزی هستی؟</span><span className="block truncate text-xs text-ink-muted">مبل، فرش، سبک یا فروشگاه…</span></span>
                  <ArrowLeft size={18} className="shrink-0 text-terracotta" />
                </button>
                <ButtonLink href="/ai/design" variant="gold" size="lg" className="min-h-14 rounded-2xl px-5"><Wand2 size={18} /> شروع طراحی AI</ButtonLink>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.42 }} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-cream/72 sm:text-sm">
                <span className="flex items-center gap-1.5"><Search size={14} className="text-gold-soft" /><b className="text-cream">{toFa(products.length)}</b> محصول منتخب</span>
                <span className="flex items-center gap-1.5"><Users size={14} className="text-gold-soft" /><b className="text-cream">{toFa(stores.length)}</b> فروشگاه معتبر</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-sage-soft" /> ضمانت خرید و بازگشت</span>
              </motion.div>
            </div>
          </Container>
        </motion.div>

        <div className="absolute inset-x-0 bottom-5 z-10 hidden justify-center sm:flex"><motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex flex-col items-center gap-1 text-cream/50"><span className="text-[10px] tracking-[.2em]">کشف کن</span><ChevronDown size={18} /></motion.div></div>
      </section>

      <section className="surface-emerald border-y border-gold/15 py-4 text-cream">
        <Container>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
            {[[Lightbulb, "الهام قابل خرید"], [Store, "چندفروشگاهی"], [Sparkles, "طراحی هوشمند"], [BadgeCheck, "فروشنده معتبر"]].map(([Icon, title]) => (
              <div key={title as string} className="flex items-center justify-center gap-2 text-center text-xs font-medium text-cream/78 sm:text-sm"><Icon size={17} className="shrink-0 text-gold-soft" /> {title as string}</div>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="سریع پیدا کن" title="از کجای خانه شروع می‌کنی؟" desc="دسته‌بندی‌های اصلی را بر اساس فضای خانه و نیازت کاوش کن." action={<Link href="/products" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه محصولات <ArrowLeft size={16} /></Link>} /></Reveal>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 6).map((category) => (
              <RevealItem key={category.id}>
                <Link href={`/category/${category.slug}`} className="group card-surface card-interactive block h-full overflow-hidden">
                  <div className="relative aspect-[4/3] overflow-hidden"><SmartImage src={category.image} alt={category.name} className="h-full w-full" /><div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" /><span className="absolute bottom-2 right-2 rounded-full bg-cream/90 px-2 py-1 text-[10px] font-bold text-ink backdrop-blur">{toFa(category.productCount)} محصول</span></div>
                  <div className="p-3"><h3 className="text-sm font-black text-ink transition group-hover:text-terracotta-deep sm:text-base">{category.name}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-muted sm:text-xs">{category.description}</p></div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </Container>
      </section>

      <section className="section-space-sm border-y border-clay/25 bg-cream/38">
        <Container>
          <Reveal><SectionHeading eyebrow="انتخاب سردبیر" title="محصولاتی برای زندگی واقعی" desc="منتخب‌های محبوب با قیمت شفاف، فروشنده معتبر و امکان مقایسه." action={<Link href="/products" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">مشاهده همه <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{trendingProducts.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</div>
        </Container>
      </section>

      <section className="section-space">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] surface-emerald text-cream shadow-[var(--shadow-lift)]">
              <div className="grid min-h-[560px] lg:grid-cols-[.9fr_1.1fr] lg:min-h-[510px]">
                <div className="relative min-h-64 overflow-hidden lg:order-2 lg:min-h-full"><SmartImage src={IMG.living2} alt="طراحی فضای نشیمن با Homeino AI" className="absolute inset-0 h-full w-full" /><div className="absolute inset-0 bg-gradient-to-t from-ink/72 via-transparent to-transparent lg:bg-gradient-to-r lg:from-ink/30 lg:to-transparent" /><button className="absolute left-4 top-4 flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-ink/45 px-3 text-xs font-bold text-cream backdrop-blur"><Play size={14} className="fill-current" /> دموی طراحی</button><div className="absolute bottom-4 right-4 rounded-xl border border-white/15 bg-cream/92 p-3 text-ink shadow-lg backdrop-blur"><div className="text-[10px] font-bold text-terracotta-deep">پیشنهاد هوشمند</div><div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#c4a47d]" /><span className="text-xs font-bold">پالت گرم و طبیعی</span></div></div></div>
                <div className="relative flex flex-col justify-center p-6 sm:p-9 lg:p-12"><div className="absolute inset-0 grain opacity-50" /><div className="relative"><Badge tone="gold" className="border-gold/35 bg-gold/10 text-gold-soft"><Sparkles size={12} /> Homeino AI</Badge><h2 className="mt-5 text-balance text-3xl font-black text-cream sm:text-4xl">قبل از خرید، نتیجه را در خانه‌ات ببین.</h2><p className="mt-4 text-pretty text-sm leading-8 text-cream/68 sm:text-base">عکس فضای خودت را بارگذاری کن، سبک و وسایل را انتخاب کن و یک پیش‌نمایش هوشمند بساز. سپس محصولات همان چیدمان را مستقیم بخر.</p><div className="mt-6 grid gap-2 text-sm text-cream/78 sm:grid-cols-2">{["آپلود امن تصویر", "انتخاب سبک و بودجه", "محصولات واقعی بازارگاه", "خرید کامل چیدمان"].map((item) => <div key={item} className="flex items-center gap-2"><BadgeCheck size={15} className="text-sage-soft" /> {item}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/ai/design" variant="gold" size="lg"><Wand2 size={18} /> طراحی فضای من</ButtonLink><ButtonLink href="/ai" variant="ghost" size="lg" className="border-white/20 text-cream hover:bg-white/10 hover:text-cream">آشنایی با امکانات</ButtonLink></div></div></div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="section-space-sm bg-ink text-cream">
        <Container>
          <Reveal><SectionHeading inverse eyebrow="CURATED STORIES" title="کالکشن‌هایی با حس و داستان" desc="ترکیب‌های آماده برای وقتی می‌خواهی سریع‌تر به یک فضای هماهنگ برسی." action={<Link href="/inspiration" className="inline-flex items-center gap-1 text-sm font-bold text-gold-soft">الهام بیشتر <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.slice(0, 6).map((collection, index) => (
              <Link key={collection.id} href="/inspiration" className={index === 0 ? "group relative min-h-72 overflow-hidden rounded-[var(--radius-lg)] sm:col-span-2 lg:row-span-2 lg:min-h-full" : "group relative min-h-56 overflow-hidden rounded-[var(--radius-lg)]"}>
                <SmartImage src={collection.image} alt={collection.title} className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-5"><span className="text-[11px] text-gold-soft">{toFa(collection.count)} انتخاب</span><h3 className="mt-1 text-xl font-black text-cream">{collection.title}</h3><p className="mt-1 text-xs text-cream/65">{collection.subtitle}</p></div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="فضاهای واقعی" title="ببین، الهام بگیر، همان چیدمان را بخر" desc="هر تصویر به محصولات واقعی متصل است؛ فاصله الهام تا خرید فقط چند لمس." action={<Link href="/inspiration" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">ورود به گالری <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{inspirations.slice(0, 7).map((inspiration, index) => <div key={inspiration.id} className={index === 0 ? "col-span-2 row-span-2" : ""}><InspirationCard insp={inspiration} index={index} /></div>)}</div>
        </Container>
      </section>

      <section className="section-space-sm border-y border-clay/25 bg-cream/38">
        <Container>
          <Reveal><SectionHeading eyebrow="اعتماد در هر خرید" title="فروشگاه‌های منتخب Homeino" desc="هویت، امتیاز و سابقه هر فروشگاه روشن است تا با خیال آسوده انتخاب کنی." action={<Link href="/stores" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه فروشگاه‌ها <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stores.filter((store) => store.verified).slice(0, 4).map((store) => <StoreCard key={store.id} store={store} />)}</div>
          <div className="mt-8 grid gap-3 rounded-[var(--radius-lg)] border border-clay/35 bg-cream p-4 sm:grid-cols-3 sm:p-6">{[[ShieldCheck, "ضمانت اصالت", "فروشنده و کالا بررسی می‌شوند"], [Truck, "ارسال قابل پیگیری", "وضعیت هر مرسوله شفاف است"], [HeartHandshake, "پشتیبانی خرید", "از انتخاب تا بازگشت کنار تو هستیم"]].map(([Icon, title, desc]) => <div key={title as string} className="flex items-start gap-3 rounded-xl p-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/12 text-success"><Icon size={18} /></span><div><div className="text-sm font-black text-ink">{title as string}</div><p className="mt-0.5 text-xs leading-6 text-ink-muted">{desc as string}</p></div></div>)}</div>
        </Container>
      </section>

      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="زبان طراحی تو" title="سبکت را پیدا کن" desc="از مینیمال تا کلاسیک؛ راهنمای هر سبک، پالت و محصولات هماهنگ را یک‌جا ببین." /></Reveal>
          <div className="hide-scrollbar scroll-fade -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {styles.slice(0, 5).map((style) => <Link key={style.slug} href={`/styles/${style.slug}`} className="group card-surface card-interactive w-[72vw] max-w-64 shrink-0 snap-start overflow-hidden lg:w-auto"><div className="relative aspect-[4/5] overflow-hidden"><SmartImage src={style.image} alt={`سبک ${style.name}`} className="h-full w-full transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-cream"><div className="text-[10px] tracking-wider text-gold-soft">{style.nameEn}</div><h3 className="mt-1 text-xl font-black text-cream">{style.name}</h3><p className="mt-1 text-xs text-cream/68">{style.tagline}</p></div></div></Link>)}
          </div>
        </Container>
      </section>

      <section className="pb-8 sm:pb-12">
        <Container>
          <div className="overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-l from-terracotta-deep to-ink p-6 text-cream shadow-[var(--shadow-card)] sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-sm font-bold text-gold-soft"><Rating value={4.9} count={2840} /> انتخاب هزاران خانه‌دوست</div><h2 className="text-balance text-2xl font-black text-cream sm:text-3xl">برای خانه‌ای که مدت‌ها در ذهنت بوده، همین امروز شروع کن.</h2><p className="mt-3 text-sm text-cream/65">بدون سردرگمی؛ اول الهام، بعد طراحی، مقایسه و خرید مطمئن.</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href="/products" variant="gold" size="lg"><Search size={17} /> کشف محصولات</ButtonLink><ButtonLink href="/ai/design" variant="ghost" size="lg" className="border-white/20 text-cream hover:bg-white/10 hover:text-cream"><Wand2 size={17} /> طراحی با AI</ButtonLink></div></div>
          </div>
        </Container>
      </section>
    </>
  );
}
