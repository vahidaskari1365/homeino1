"use client";
import Link from "next/link";
import { useRef, useEffect, useState } from "react";
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
  const [videoFinished, setVideoFinished] = useState(false);

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
      v.playsInline = true as any; // React attribute
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("muted", "");
      v.setAttribute("preload", "auto");
    } catch (e) {
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
  }, [setVideoFinished]);

  return (
    <>
      {/* ===== CINEMATIC HERO ===== */}
      <section ref={heroRef} className={`relative h-auto min-h-[60vh] sm:h-[100svh] sm:min-h-[640px] w-full overflow-hidden transition-colors duration-700 ${videoFinished ? "bg-ink" : "bg-black"}`}>
        {/* parallax background (video) */}
        <motion.div style={{ y: yBg, scale: scaleBg }} className="absolute inset-0">
          <video
            ref={videoRef}
            src={HERO_VIDEO}
            autoPlay
            muted
            playsInline
            webkit-playsinline="true"
            preload="auto"
            onEnded={() => setVideoFinished(true)}
            onError={() => setVideoFinished(true)}
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* layered emerald gradient overlay — only visible after the video ends */}
        <div className={`absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30 transition-opacity duration-700 ${videoFinished ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute inset-0 bg-gradient-to-l from-ink/85 via-transparent to-ink/40 transition-opacity duration-700 ${videoFinished ? "opacity-100" : "opacity-0"}`} />
        {/* aurora glow */}
        <div className={`pointer-events-none absolute -right-32 top-1/4 h-[60vh] w-[60vh] rounded-full bg-terracotta/30 blur-[120px] animate-[aurora_14s_ease-in-out_infinite_alternate] transition-opacity duration-700 ${videoFinished ? "opacity-100" : "opacity-0"}`} />
        <div className={`pointer-events-none absolute -left-24 bottom-0 h-[50vh] w-[50vh] rounded-full bg-gold/15 blur-[120px] transition-opacity duration-700 ${videoFinished ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute inset-0 grain transition-opacity duration-700 ${videoFinished ? "opacity-40" : "opacity-0"}`} />

        {/* content — revealed only after the hero video ends */}
        {videoFinished && (
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
        )}

        {/* scroll indicator — shown after the video ends */}
        {videoFinished && (
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex flex-col items-center gap-1 text-cream/50">
            <span className="text-[11px] tracking-widest">اسکرول کن</span>
            <ChevronDown size={18} />
          </motion.div>
        </div>
        )}
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

    </>
  );
}
