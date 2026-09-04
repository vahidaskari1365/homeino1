"use client";
import Link from "next/link";
import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Sparkles, ArrowLeft, Play, Wand2, ChevronDown, Lightbulb, Store, BadgeCheck, Users, ShieldCheck, HeartHandshake, Truck } from "lucide-react";
import { Container, SectionHeading, Badge, ButtonLink, Rating } from "@/components/ui/primitives";
import { StoreCard, InspirationCard } from "@/components/cards";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { stores, collections } from "@/data/stores";
import { products as allProducts, productsByStyle } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { IMG } from "@/data/media";
import { SmartImage } from "@/components/ui/SmartImage";
import { toFa } from "@/lib/utils";

const HERO_VIDEO = "/video/01.mp4";
const HERO_POSTER = "/video/hero-poster.jpg";

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scaleBg = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Ensure attributes are set for maximum autoplay compatibility on mobile
    try {
      v.defaultMuted = true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("muted", "");
      v.setAttribute("preload", "metadata");
    } catch {
      // ignore
    }

    let cancelled = false;

    // Programmatic autoplay. On iOS Safari a play() call made before the video
    // has buffered data rejects, so also retry once the video is ready.
    const tryPlay = () => {
      if (cancelled || !v.paused) return;
      const p = v.play();
      if (p) {
        p.catch(() => {
          // Some browsers still block autoplay even when muted: the
          // first-interaction fallback below starts playback on tap.
        });
      }
    };

    v.addEventListener("loadeddata", tryPlay);
    v.addEventListener("canplay", tryPlay);

    // Try programmatic autoplay right away.
    tryPlay();

    // Fallback: start playback on any first user interaction (touch/pointer).
    const resumePlayback = () => {
      tryPlay();
      // Remove listeners after first interaction
      window.removeEventListener("touchstart", resumePlayback);
      window.removeEventListener("pointerdown", resumePlayback);
    };
    window.addEventListener("touchstart", resumePlayback, { once: true });
    window.addEventListener("pointerdown", resumePlayback, { once: true });

    return () => {
      cancelled = true;
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      window.removeEventListener("touchstart", resumePlayback);
      window.removeEventListener("pointerdown", resumePlayback);
    };
  }, []);

  return (
    <>
      {/* ===== CINEMATIC HERO ===== */}
      <section ref={heroRef} className="relative h-auto min-h-[60vh] sm:h-[100svh] sm:min-h-[640px] w-full overflow-hidden bg-ink">
        {/* parallax background (video) */}
        <motion.div style={{ y: yBg, scale: scaleBg }} className="absolute inset-0">
          <video
            ref={videoRef}
            src={HERO_VIDEO}
            autoPlay
            muted
            playsInline
            webkit-playsinline="true"
            preload="metadata"
            poster={HERO_POSTER}
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* layered emerald gradient overlay — only visible after the video ends */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30 opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-transparent to-ink/40 opacity-100" />
        {/* aurora glow */}
        <div className="pointer-events-none absolute -right-32 top-1/4 h-[60vh] w-[60vh] rounded-full bg-terracotta/30 blur-[120px] animate-[aurora_14s_ease-in-out_infinite_alternate] opacity-100" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-[50vh] w-[50vh] rounded-full bg-gold/15 blur-[120px] opacity-100" />
        <div className="absolute inset-0 grain opacity-40" />

        {/* content — shown immediately; video plays behind it */}
        <motion.div style={{ opacity }} className="relative z-10 flex h-full flex-col justify-center">
          <Container className="py-10 px-4 sm:px-0">
            <div className="max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                <Badge tone="dark" className="mb-6 border-gold/30 bg-white/10 px-4 py-1.5 text-gold-soft backdrop-blur">
                  <Sparkles size={13} /> خانه · دکوراسیون · هوش مصنوعی
                </Badge>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 28, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, delay: 0.08, ease: [0.16, 1, 0.3, 1] } as any} className="mt-3 font-display text-4xl font-black leading-tight text-cream sm:text-6xl">
                خانه ایی که <span className="text-gold-gradient">شبیه توست</span> ، همین جا آغاز می شود
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25 }} className="mt-5 max-w-xl text-base sm:text-lg leading-7 sm:leading-8 text-cream/80">
                سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.32 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-cream px-6 py-3 font-bold text-ink transition hover:translate-y-[-2px] hover:shadow-gold">
                  <Search size={18} /> کشف محصولات
                </Link>
                <Link href="/ai/design" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cream/30 px-5 py-3 font-medium text-cream transition hover:bg-white/10">
                  <Wand2 size={18} /> طراحی فضای من با AI
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} className="mt-8 flex flex-wrap items-center gap-4 text-sm text-cream/70">
                <span className="flex items-center gap-1.5"><Search size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(allProducts.length)}</b> محصول منتخب</span>
                <span className="hidden text-cream/30 sm:inline">|</span>
                <span className="flex items-center gap-1.5"><Users size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(stores.length)}</b> فروشگاه معتبر</span>
                <span className="hidden text-cream/30 sm:inline">|</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-sage-soft" /> خرید امن با ضمانت بازگشت</span>
              </motion.div>
            </div>
          </Container>
        </motion.div>

        {/* scroll indicator */}
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex flex-col items-center gap-1 text-cream/50">
            <span className="text-[11px] tracking-widest">اسکرول کن</span>
            <ChevronDown size={18} />
          </motion.div>
        </div>
      </section>

      {/* ===== VALUE STRIP ===== */}
      <section className="surface-emerald border-y border-gold/15 py-5 text-cream">
        <Container>
          <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            {[[Lightbulb, "الهام‌بخش و واقعی"], [Store, "بازارگاه چندفروشگاهی"], [Sparkles, "طراحی با هوش مصنوعی"], [BadgeCheck, "فروشگاه معتبر"]].map(([Icon, t]) => (
              <div key={t as string} className="flex items-center justify-center gap-2 text-sm text-cream/80"><Icon size={18} className="text-gold-soft" /> {t as string}</div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== CATEGORIES ===== */}
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

      {/* ===== SHOP BY STYLE ===== */}
      <section className="section-space-sm border-y border-clay/25 bg-cream/38">
        <Container>
          <Reveal><SectionHeading eyebrow="خرید بر اساس سبک" title="محصولی که دوست داری را از روی سبک مورد علاقت پیدا و انتخاب کن" desc="روی سبک مورد علاقه‌ات بزن تا محصولات هماهنگ با همان سبک برایت مرتب و نمایش داده شود؛ داخل صفحه‌ی هر سبک می‌توانی بر اساس دسته‌بندی‌های سایت هم فیلتر کنی." action={<Link href="/styles" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">راهنمای همه سبک‌ها <ArrowLeft size={16} /></Link>} /></Reveal>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {styles.map((style) => (
              <RevealItem key={style.id}>
                <Link href={`/styles/${style.slug}`} className="group card-surface card-interactive block h-full overflow-hidden">
                  <div className="relative aspect-square overflow-hidden">
                    <SmartImage src={style.image} alt={`سبک ${style.name}`} className="h-full w-full transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                    <span className="absolute left-2 top-2 rounded-full bg-cream/90 px-2 py-1 text-[10px] font-bold text-ink backdrop-blur">{toFa(productsByStyle(style.slug).length)} محصول</span>
                    <div className="absolute inset-x-0 bottom-0 p-3 text-cream sm:p-4">
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-gold-soft">{style.nameEn}</div>
                      <h3 className="mt-0.5 text-base font-black text-cream transition group-hover:text-gold-soft sm:text-lg">{style.name}</h3>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-cream/70 sm:text-xs">{style.tagline}</p>
                    </div>
                  </div>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </Container>
      </section>

      {/* ===== AI FEATURE ===== */}
      <section className="section-space">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] surface-emerald text-cream shadow-[var(--shadow-lift)]">
              <div className="grid min-h-[560px] lg:grid-cols-[.9fr_1.1fr] lg:min-h-[510px]">
                <div className="relative min-h-64 overflow-hidden lg:order-2 lg:min-h-full"><SmartImage src={IMG.living2} alt="طراحی فضای نشیمن با Homeino AI" className="absolute inset-0 h-full w-full" /><div className="absolute inset-0 bg-gradient-to-t from-ink/72 via-transparent to-transparent lg:bg-gradient-to-r lg:from-ink/30 lg:to-transparent" /><button className="absolute left-4 top-4 flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-ink/45 px-3 text-xs font-bold text-cream backdrop-blur"><Play size={14} className="fill-current" /> دموی طراحی</button><div className="absolute bottom-4 right-4 rounded-xl border border-white/15 bg-cream/92 p-3 text-ink shadow-lg backdrop-blur"><div className="text-[10px] font-bold text-terracotta-deep">پیشنهاد هوشمند</div><div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#c4a47d]" /><span className="text-xs font-bold">پالت گرم و طبیعی</span></div></div></div>
                <div className="relative flex flex-col justify-center p-6 sm:p-9 lg:p-12"><div className="absolute inset-0 grain opacity-50" /><div className="relative"><Badge tone="gold" className="border-gold/35 bg-gold/10 text-gold-soft"><Sparkles size={12} /> Homeino AI</Badge><h2 className="mt-5 text-balance text-3xl font-black text-cream sm:text-4xl">قبل از خرید، نتیجه را در خانه‌ات ببین.</h2><p className="mt-4 text-pretty text-sm leading-8 text-cream/68 sm:text-base">عکس فضای خودت را بارگذاری کن، سبک و وسایل را انتخاب کن و یک پیش‌نمایش هوشمند بساز. سپس محصولات همان چیدمان را مستقیم بخر.</p><div className="mt-6 grid gap-2 text-sm text-cream/78 sm:grid-cols-2">{["آپلود امن تصویر", "انتخاب سبک و بودجه", "محصولات واقعی بازارگاه", "خرید کامل چیدمان"].map((item) => <div key={item} className="flex items-center gap-2"><BadgeCheck size={15} className="text-sage-soft" /> {item}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/ai/design" variant="gold" size="lg"><Wand2 size={18} /> طراحی فضای من</ButtonLink><ButtonLink href="/inspiration" variant="ghost" size="lg" className="border-white/20 text-cream hover:bg-white/10 hover:text-cream">دنبال الهام بگرد</ButtonLink></div></div></div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ===== COLLECTIONS ===== */}
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

      {/* ===== INSPIRATION ===== */}
      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="فضاهای واقعی" title="ببین، الهام بگیر، همان چیدمان را بخر" desc="هر تصویر به محصولات واقعی متصل است؛ فاصله الهام تا خرید فقط چند لمس." action={<Link href="/inspiration" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">ورود به گالری <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{inspirations.slice(0, 7).map((inspiration, index) => <div key={inspiration.id} className={index === 0 ? "col-span-2 row-span-2" : ""}><InspirationCard insp={inspiration} index={index} /></div>)}</div>
        </Container>
      </section>

      {/* ===== STORES & TRUST ===== */}
      <section className="section-space-sm border-y border-clay/25 bg-cream/38">
        <Container>
          <Reveal><SectionHeading eyebrow="اعتماد در هر خرید" title="فروشگاه‌های منتخب Homeino" desc="هویت، امتیاز و سابقه هر فروشگاه روشن است تا با خیال آسوده انتخاب کنی." action={<Link href="/stores" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">همه فروشگاه‌ها <ArrowLeft size={16} /></Link>} /></Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stores.filter((store) => store.verified).slice(0, 4).map((store) => <StoreCard key={store.id} store={store} />)}</div>
          <div className="mt-8 grid gap-3 rounded-[var(--radius-lg)] border border-clay/35 bg-cream p-4 sm:grid-cols-3 sm:p-6">{[[ShieldCheck, "ضمانت اصالت", "فروشنده و کالا بررسی می‌شوند"], [Truck, "ارسال قابل پیگیری", "وضعیت هر مرسوله شفاف است"], [HeartHandshake, "پشتیبانی خرید", "از انتخاب تا بازگشت کنار تو هستیم"]].map(([Icon, title, desc]) => <div key={title as string} className="flex items-start gap-3 rounded-xl p-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/12 text-success"><Icon size={18} /></span><div><div className="text-sm font-black text-ink">{title as string}</div><p className="mt-0.5 text-xs leading-6 text-ink-muted">{desc as string}</p></div></div>)}</div>
        </Container>
      </section>

      {/* ===== STYLES ===== */}
      <section className="section-space-sm">
        <Container>
          <Reveal><SectionHeading eyebrow="زبان طراحی تو" title="سبکت را پیدا کن" desc="از مینیمال تا کلاسیک؛ راهنمای هر سبک، پالت و محصولات هماهنگ را یک‌جا ببین." /></Reveal>
          <div className="hide-scrollbar scroll-fade -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {styles.slice(0, 5).map((style) => <Link key={style.slug} href={`/styles/${style.slug}`} className="group card-surface card-interactive w-[72vw] max-w-64 shrink-0 snap-start overflow-hidden lg:w-auto"><div className="relative aspect-[4/5] overflow-hidden"><SmartImage src={style.image} alt={`سبک ${style.name}`} className="h-full w-full transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-ink/88 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 text-cream"><div className="text-[10px] tracking-wider text-gold-soft">{style.nameEn}</div><h3 className="mt-1 text-xl font-black text-cream">{style.name}</h3><p className="mt-1 text-xs text-cream/68">{style.tagline}</p></div></div></Link>)}
          </div>
        </Container>
      </section>

      {/* ===== FINAL CTA ===== */}
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
