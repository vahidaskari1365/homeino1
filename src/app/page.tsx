"use client";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Sparkles, ArrowLeft, Play, Wand2, Star, ChevronDown, Quote, Lightbulb, Store, BadgeCheck, Users, ShieldCheck, TrendingUp, Clock, Truck, RotateCcw } from "lucide-react";
import { Container, SectionHeading, Badge, Button, Rating, LogoBlock } from "@/components/ui/primitives";
import { ProductCard, StoreCard, InspirationCard } from "@/components/cards";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { stores } from "@/data/stores";
import { collections } from "@/data/stores";
import { trendingProducts, products as allProducts } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { stores as allStores } from "@/data/stores";
import { PLATFORM } from "@/config/platform";
import { SmartImage } from "@/components/ui/SmartImage";
import { toFa } from "@/lib/utils";

const HERO_VIDEO = "/video/01.mp4";
const AI_IMG = "/images/ai-feature.jpg";

export default function HomePage() {
  const { setSearch } = useUi();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scaleBg = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <>
      {/* ===== CINEMATIC HERO ===== */}
      <section ref={heroRef} className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-ink">
        {/* parallax background */}
        <motion.div style={{ y: yBg, scale: scaleBg }} className="absolute inset-0">
          <video src={HERO_VIDEO} autoPlay muted loop playsInline poster="/images/hero.jpg" className="h-full w-full object-cover" />
        </motion.div>
        {/* layered emerald gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-transparent to-ink/40" />
        {/* aurora glow */}
        <div className="pointer-events-none absolute -right-32 top-1/4 h-[60vh] w-[60vh] rounded-full bg-terracotta/30 blur-[120px] animate-[aurora_14s_ease-in-out_infinite_alternate]" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-[50vh] w-[50vh] rounded-full bg-gold/15 blur-[120px]" />
        <div className="absolute inset-0 grain opacity-40" />

        {/* content */}
        <motion.div style={{ opacity }} className="relative z-10 flex h-full flex-col justify-center">
          <Container className="py-10">
            <div className="max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                <Badge tone="dark" className="mb-6 border-gold/30 bg-white/10 px-4 py-1.5 text-gold-soft backdrop-blur">
                  <Sparkles size={13} /> خانه · دکوراسیون · هوش مصنوعی
                </Badge>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 28, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="font-display text-[2.05rem] font-black leading-[1.14] text-cream text-shadow-soft sm:text-6xl lg:text-7xl text-balance">
                خانه‌ای که <span className="text-gold-gradient">شبیهِ خودت</span> می‌نَفَسَد
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25 }} className="mt-5 max-w-xl text-lg leading-8 text-cream/80">
                الهام بگیر، محصول پیدا کن، فروشگاه‌ها را مقایسه کن و اتاقت را با هوش مصنوعی طراحی کن — همه در یک مرجع لاکچری.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.32 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-cream px-7 py-3.5 font-bold text-ink transition hover:translate-y-[-2px] hover:shadow-gold">
                  <Search size={18} /> کشف محصولات
                </Link>
                <Link href="/ai" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cream/30 px-6 py-3.5 font-medium text-cream transition hover:bg-white/10">
                  <Wand2 size={18} /> طراحی فضای من با AI
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/85">
                <span className="flex items-center gap-1.5"><Search size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(allProducts.length)}</b> محصول منتخب</span>
                <span className="hidden text-cream/30 sm:inline">|</span>
                <span className="flex items-center gap-1.5"><Users size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(allStores.length)}</b> فروشگاه معتبر</span>
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
            {[[Lightbulb, "الهام‌بخش و واقعی"], [Store, "بازارگاه چندفروشگاهی"], [Sparkles, "طراحی با هوش مصنوعی"], [BadgeCheck, "فروشگاه‌های معتبر"]].map(([Icon, t]) => (
              <div key={t as string} className="flex items-center justify-center gap-2 text-sm text-cream/80"><Icon size={18} className="text-gold-soft" /> {t as string}</div>
            ))}
          </div>
        </Container>
      </section>

      {/* ===== TRUST BADGES — builds instant confidence ===== */}
      <Container className="py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "خرید کاملاً امن", desc: "پرداخت رمزنگاری‌شده", color: "text-sage" },
            { icon: Truck, title: "ارسال سریع", desc: "از فروشگاه منتخب شما", color: "text-terracotta-deep" },
            { icon: RotateCcw, title: `${toFa(PLATFORM.policies.returnDays)} روز بازگشت`, desc: "ضمانت رضایت کامل", color: "text-gold" },
            { icon: Sparkles, title: "طراحی رایگان", desc: `${toFa(PLATFORM.ai.startingCredits)} اعتبار هدیه اول`, color: "text-gold" },
          ].map((b) => (
            <div key={b.title} className="flex items-center gap-2.5 rounded-2xl border border-clay/40 bg-cream/60 p-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ivory-2 ${b.color}`}><b.icon size={20} /></span>
              <div><div className="text-sm font-bold text-ink">{b.title}</div><div className="text-[11px] text-ink-muted">{b.desc}</div></div>
            </div>
          ))}
        </div>
      </Container>

      {/* ===== CATEGORIES ===== */}
      <Container className="py-16 sm:py-24">
        <Reveal>
          <SectionHeading eyebrow="دسته‌بندی‌ها" title="دنیای خانه را کاوش کن" desc="از مبلمان و نورپردازی تا فرش، دکوراسیون و فضای کار — هر چیزی سر جای خودش." action={<Link href="/products" className="link-underline text-sm font-medium text-terracotta-deep">همه محصولات ←</Link>} />
        </Reveal>
        <RevealGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((c, i) => (
            <RevealItem key={c.id}>
              <Link href={`/category/${c.slug}`} className={`group relative block overflow-hidden rounded-[var(--radius-lg)] sheen ${i === 0 || i === 5 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
                <SmartImage src={c.image} alt={c.name} className={`w-full transition-transform duration-700 group-hover:scale-110 ${i === 0 || i === 5 ? "aspect-square sm:aspect-[2/1.05]" : "aspect-[4/3]"}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute bottom-0 p-4 text-cream">
                  <div className="text-[11px] text-gold-soft">{toFa(c.productCount)} محصول</div>
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>
                </div>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>

      {/* ===== FLASH OFFER — urgency + scarcity ===== */}
      <Container className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-l from-ink to-ink-soft p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-danger/20"><Clock size={20} className="text-danger" /></span>
            <div>
              <p className="text-sm font-bold text-cream">آفر هفته — تا ۴۰٪ تخفیف روی منتخب مبلمان</p>
              <p className="text-[11px] text-cream/60">فقط تا پایان این هفته · موجودی محدود</p>
            </div>
          </div>
          <Link href="/products" className="rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-ink transition hover:opacity-90">مشاهده محصولات</Link>
        </div>
      </Container>

      {/* ===== TRENDING PRODUCTS ===== */}
      <Container className="py-10 sm:py-16">
        <Reveal>
          <SectionHeading eyebrow={<span className="flex items-center gap-1"><TrendingUp size={13} /> پرفروش‌ترین‌ها</span> as unknown as string} title="محصولاتی که همه الان می‌خرن" desc="به‌تیم محبوب‌ترین‌های این هفته رو نشون می‌دیم — این‌ها با سرعت دارن تموم می‌شن" action={<Link href="/products" className="link-underline text-sm font-medium text-terracotta-deep">مشاهده همه ←</Link>} />
        </Reveal>
        <RevealGroup className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {trendingProducts.slice(0, 4).map((p) => <RevealItem key={p.id}><ProductCard product={p} /></RevealItem>)}
        </RevealGroup>
      </Container>

      {/* ===== AI STUDIO — subtle feature (AI is one capability, not the whole product) ===== */}
      <Container className="py-12">
        <Reveal>
          <Link href="/ai" className="group flex flex-col items-center gap-6 overflow-hidden rounded-[var(--radius-2xl)] border border-clay/40 bg-cream p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-card)] sm:p-10 lg:flex-row lg:gap-10">
            <div className="relative w-full max-w-xs shrink-0 overflow-hidden rounded-2xl">
              <SmartImage src={AI_IMG} alt="طراحی هوشمند اتاق" className="aspect-[4/3] w-full transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="text-center lg:text-right">
              <Badge tone="gold" className="mb-3"><Sparkles size={12} /> یکی از امکانات Homeino</Badge>
              <h2 className="font-display text-2xl font-black leading-tight text-ink sm:text-3xl">عکس خانه‌ات را بده، با هوش مصنوعی <span className="text-emerald-gradient">طراحی‌اش کن</span></h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted lg:mx-0">فضایت را آپلود کن، سبک دلخواهت را انتخاب کن و محصولات مناسب را خودکار پیدا کن. یک ابزار هوشمند در کنار هزاران محصول واقعی.</p>
              <span className="link-underline mt-4 inline-block text-sm font-bold text-terracotta-deep">امتحان کن →</span>
            </div>
          </Link>
        </Reveal>
      </Container>

      {/* ===== STORES ===== */}
      <Container className="py-16 sm:py-24">
        <Reveal>
          <SectionHeading eyebrow="فروشگاه‌ها" title="فروشگاه‌های منتخب و معتبر" desc="برندها و فروشندگانی که به آن‌ها اعتماد داریم." action={<Link href="/stores" className="link-underline text-sm font-medium text-terracotta-deep">همه فروشگاه‌ها ←</Link>} />
        </Reveal>
        <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stores.slice(0, 4).map((s) => <RevealItem key={s.id}><StoreCard store={s} /></RevealItem>)}
        </RevealGroup>
      </Container>

      {/* ===== INSPIRATION ===== */}
      <Container className="py-10 sm:py-16">
        <Reveal>
          <SectionHeading eyebrow="الهام" title="ایده بگیر، نه فقط بخر" desc="هزاران طراحی دکوراسیون. روی هر تصویر کلیک کن تا محصولاتی که داخلش هست را ببینی." action={<Link href="/inspiration" className="link-underline text-sm font-medium text-terracotta-deep">گالری کامل ←</Link>} />
        </Reveal>
        <div className="columns-2 gap-4 lg:columns-3 xl:columns-4 [&>*]:mb-4">
          {inspirations.slice(0, 10).map((insp, i) => <Reveal key={insp.id} delay={(i % 4) * 0.05}><InspirationCard insp={insp} index={i} /></Reveal>)}
        </div>
      </Container>

      {/* ===== TESTIMONIAL ===== */}
      <section className="my-10">
        <Container>
          <Reveal>
            <div className="surface-emerald relative overflow-hidden rounded-[var(--radius-2xl)] p-10 text-center text-cream sm:p-16">
              <div className="absolute inset-0 grain opacity-30" />
              <Quote size={40} className="relative mx-auto mb-4 text-gold" />
              <p className="relative mx-auto max-w-2xl font-display text-2xl font-bold leading-relaxed sm:text-3xl text-balance">«هر چیزی که برای ساختن خانه‌ای که دوست داری لازم داری، در یک مکان.»</p>
              <div className="relative mt-5 text-sm text-gold-soft">Homeino — مرجع خانه، دکوراسیون و زندگی</div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ===== SOCIAL PROOF — only in development (no fake reviews in production) ===== */}
      {PLATFORM.socialProof.showTestimonials && (
      <section className="bg-ivory-2 py-16 sm:py-24">
        <Container>
          <Reveal>
            <SectionHeading eyebrow="نظر مشتریان" title="تجربه‌ی خریداران Homeino" />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "نگار محمدی", city: "تهران", text: "کاناپه‌ای که خریدم دقیقاً مثل عکس بود. کیفیت‌اش فوق‌العاده‌ست و با هوش مصنوعی سایت تونستم ببینم تو پذیراییم چطور می‌شه.", rating: 5, product: "کاناپه هلیم" },
              { name: "آرش رستمی", city: "اصفهان", text: "بهترین تجربه خرید آنلاین مبلمان. ارسال سریع، بسته‌بندی عالی و قیمت منصفانه. فروشگاه نور مبلمان واقعاً معتبره.", rating: 5, product: "مبل راحتی لوومی" },
              { name: "سارا کاظمی", city: "شیراز", text: "با طراحی هوش مصنوعی اتاق خوابم رو عوض کردم بعد هموسش همه محصولاتشو از همین سایت خریدم. عالی بود!", rating: 5, product: "طراحی اتاق خواب" },
            ].map((rev, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="card-surface p-5">
                  <div className="mb-2 flex items-center gap-2">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={14} className="fill-gold text-gold" />)}
                  </div>
                  <p className="text-sm leading-7 text-ink-muted">«{rev.text}»</p>
                  <div className="mt-4 flex items-center justify-between border-t border-clay/30 pt-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{rev.name}</p>
                      <p className="text-xs text-ink-muted">{rev.city}</p>
                    </div>
                    <span className="rounded-full bg-sage/10 px-2 py-0.5 text-[10px] font-medium text-sage">خرید تأیید‌شده</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
      )}

      {/* ===== STYLES ===== */}
      <Container className="py-16 sm:py-24">
        <Reveal>
          <SectionHeading eyebrow="سبک‌ها" title="سبک دکوراسیون خودت را پیدا کن" action={<Link href="/styles" className="link-underline text-sm font-medium text-terracotta-deep">همه سبک‌ها ←</Link>} />
        </Reveal>
        <div className="hide-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
          {styles.map((s) => (
            <Link key={s.slug} href={`/styles/${s.slug}`} className="group relative w-56 shrink-0 overflow-hidden rounded-2xl sheen">
              <SmartImage src={s.image} alt={s.name} className="aspect-[3/4] w-full transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/92 to-transparent" />
              <div className="absolute bottom-0 p-4 text-cream">
                <h3 className="font-display text-lg font-bold">{s.name}</h3>
                <p className="text-xs text-gold-soft">{s.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>

      {/* ===== COLLECTIONS ===== */}
      <Container className="py-10 sm:py-16">
        <Reveal>
          <SectionHeading eyebrow="کالکشن‌ها" title="مجموعه‌های انتخاب‌شده" desc="ترکیب‌های آماده برای فضاهای خاص." />
        </Reveal>
        <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((col) => (
            <RevealItem key={col.id}>
              <Link href="/inspiration" className="group relative block overflow-hidden rounded-2xl sheen">
                <SmartImage src={col.image} alt={col.title} className="aspect-[16/10] w-full transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
                <div className="absolute bottom-0 flex w-full items-end justify-between p-5 text-cream">
                  <div><h3 className="font-display text-xl font-bold">{col.title}</h3><p className="text-sm text-gold-soft">{col.subtitle}</p></div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 backdrop-blur transition group-hover:bg-gold group-hover:text-ink"><ArrowLeft size={18} /></span>
                </div>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>

      {/* ===== FINAL CTA ===== */}
      <Container className="py-16">
        <Reveal>
          <div className="surface-emerald relative overflow-hidden rounded-[var(--radius-2xl)] p-10 text-center text-cream sm:p-20">
            <div className="absolute inset-0 grain opacity-30" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-[40vh] w-[40vh] -translate-x-1/2 rounded-full bg-gold/15 blur-[120px]" />
            <Sparkles size={32} className="relative mx-auto mb-4 text-gold" />
            <h2 className="relative font-display text-3xl font-black sm:text-5xl text-balance">آماده‌ای خانه‌ات را <span className="text-gold-gradient">متحول کنی؟</span></h2>
            <p className="relative mx-auto mt-3 max-w-md text-cream/75">همین حالا اولین طراحی هوش مصنوعی‌ات را بساز یا در میان هزاران محصول بگرد.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/ai" className="btn-gold inline-flex items-center gap-2 px-7 py-3.5 font-bold"><Wand2 size={18} /> شروع طراحی با AI</Link>
              <Link href="/products" className="inline-flex items-center gap-2 rounded-xl border border-cream/25 px-7 py-3.5 font-medium text-cream transition hover:bg-white/10">کاوش محصولات</Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
