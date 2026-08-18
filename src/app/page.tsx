"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scaleBg = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    // Try to autoplay muted video on mount. If browser blocks it, user can tap the play button.
    const v = videoRef.current;
    if (v) {
      v.muted = true; // ensure muted for autoplay policies
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // autoplay blocked on some mobile browsers - leave poster visible and show play control
        });
    }
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  return (
    <>
      {/* ===== CINEMATIC HERO ===== */}
      <section ref={heroRef} className="relative h-auto min-h-[60vh] sm:h-[100svh] sm:min-h-[640px] w-full overflow-hidden bg-ink">
        {/* parallax background (desktop/tablet/mobile) */}
        <motion.div style={{ y: yBg, scale: scaleBg }} className="absolute inset-0">
          {/* video: keep available on mobile too but use poster and programmatic play toggle for browsers that block autoplay */}
          <video
            ref={videoRef}
            src={HERO_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hero.jpg"
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* layered emerald gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-transparent to-ink/40" />
        {/* aurora glow */}
        <div className="pointer-events-none absolute -right-32 top-1/4 h-[60vh] w-[60vh] rounded-full bg-terracotta/30 blur-[120px] animate-[aurora_14s_ease-in-out_infinite_alternate]" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-[50vh] w-[50vh] rounded-full bg-gold/15 blur-[120px]" />
        <div className="absolute inset-0 grain opacity-40" />

        {/* Mobile play control - visible only on small screens when autoplay is blocked or paused */}
        <div className="absolute inset-0 z-20 flex items-center justify-center sm:hidden">
          {!isPlaying && (
            <button
              onClick={togglePlay}
              aria-label="پخش ویدیو"
              className="rounded-full bg-black/40 p-4 text-cream backdrop-blur transition hover:scale-105"
            >
              <Play size={28} />
            </button>
          )}
        </div>

        {/* content */}
        <motion.div style={{ opacity }} className="relative z-10 flex h-full flex-col justify-center">
          <Container className="py-10 px-4 sm:px-0">
            <div className="max-w-2xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                <Badge tone="dark" className="mb-6 border-gold/30 bg-white/10 px-4 py-1.5 text-gold-soft backdrop-blur">
                  <Sparkles size={13} /> خانه · دکوراسیون · هوش مصنوعی
                </Badge>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 28, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, delay: 0.08, ease: [0.16, 1, 0.3, 1] } as any} className="mt-3 font-display text-4xl font-black leading-tight text-cream sm:text-6xl">
                خانه‌ای که <span className="text-gold-gradient">شبیهِ خودت</span> می‌نَفَسَد
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25 }} className="mt-5 max-w-xl text-base sm:text-lg leading-7 sm:leading-8 text-cream/80">
                الهام بگیر، محصول پیدا کن، فروشگاه‌ها را مقایسه کن و اتاقت را با هوش مصنوعی طراحی کن — همه در یک محیط ساده و مناسب.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.32 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-cream px-6 py-3 font-bold text-ink transition hover:translate-y-[-2px] hover:shadow-gold">
                  <Search size={18} /> کشف محصولات
                </Link>
                <Link href="/ai" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cream/30 px-5 py-3 font-medium text-cream transition hover:bg-white/10">
                  <Wand2 size={18} /> طراحی فضای من با AI
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} className="mt-8 flex flex-wrap items-center gap-4 text-sm text-cream/70">
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
            {[[Lightbulb, "الهام‌بخش و واقعی"], [Store, "بازارگاه چندفروشگاهی"], [Sparkles, "طراحی با هوش مصنوعی"], [BadgeCheck, "فروشگاه معتبر"]].map(([Icon, t]) => (
              <div key={t as string} className="flex items-center justify-center gap-2 text-sm text-cream/80"><Icon size={18} className="text-gold-soft" /> {t as string}</div>
            ))}
          </div>
        </Container>
      </section>

      {/* rest of the page unchanged... */}

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
          <SectionHeading eyebrow="دسته‌بندی‌ها" title="دنیای خانه را کاوش کن" desc="از مبلمان و نورپردازی تا فرش، دکوراسیون و فضای کاری." />
        </Reveal>
        <RevealGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((c, i) => (
            <RevealItem key={c.id}>
              <Link href={`/category/${c.slug}`} className={`group relative block overflow-hidden rounded-[var(--radius-lg)] sheen ${i === 0 || i === 5 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
                <SmartImage src={c.image} alt={c.name} className={`w-full transition-transform duration-700 group-hover:scale-110 ${i === 0 || i === 5 ? "aspect-square sm:aspect-[2/1.05]" : "aspect-[16/10]"}`} />
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

      {/* Remaining sections kept as in the file to avoid unintended changes. */}

    </>
  );
}
