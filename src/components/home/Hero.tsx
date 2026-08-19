"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { ArrowLeft, ChevronDown, Search, ShieldCheck, Sparkles, Users, Wand2 } from "lucide-react";
import { Badge, ButtonLink, Container } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { useUi } from "@/stores/useApp";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { IMG } from "@/data/media";
import { toFa } from "@/lib/utils";

const HERO_VIDEO = "/video/01.mp4";
const POSTER = IMG.living5;

/** Ceiling (ms) — if the video can't start or finish for any reason, reveal content anyway. */
const MAX_WAIT_MS = 12_000;
const END_GRACE_MS = 1_200;

const EASE = [0.16, 1, 0.3, 1] as const;

type Phase = "video" | "revealed";

/**
 * Cinematic home hero.
 *
 * Sequence: VIDEO → video ends → GRADIENT/BRAND OVERLAY → HEADLINE → DESCRIPTION → CTA → TRUST SIGNALS.
 * While the video plays there is deliberately no overlay on top of it — the frame stays immersive.
 * Everything is transform/opacity-only (GPU-composited), falls back gracefully when the video
 * cannot load/autoplay, and fully respects `prefers-reduced-motion`.
 */
export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const { setSearch } = useUi();
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>(reduce ? "revealed" : "video");
  const [videoFailed, setVideoFailed] = useState(false);

  const reveal = useCallback(() => setPhase((current) => (current === "revealed" ? current : "revealed")), []);

  /* Subtle cinematic parallax — transform-only, so it stays on the compositor. */
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "11%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  useEffect(() => {
    if (reduce) return;
    const video = videoRef.current;
    if (!video) {
      reveal(); // no video mounted → never block the content
      return;
    }
    video.defaultMuted = true;
    video.muted = true;
    // Autoplay can be blocked on some platforms — reveal right away so the hero is never empty.
    video.play().catch(() => reveal());

    let fallback: ReturnType<typeof setTimeout> | undefined;
    const scheduleFallback = () => {
      if (fallback) return;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 + END_GRACE_MS : MAX_WAIT_MS;
      fallback = setTimeout(reveal, Math.min(duration, MAX_WAIT_MS));
    };
    if (video.readyState >= 1) scheduleFallback();
    else video.addEventListener("loadedmetadata", scheduleFallback, { once: true });

    const safety = setTimeout(reveal, MAX_WAIT_MS + 2_000);
    return () => {
      if (fallback) clearTimeout(fallback);
      clearTimeout(safety);
    };
  }, [reduce, reveal]);

  const showVideo = !reduce && !videoFailed;
  const revealed = phase === "revealed";

  /* Staggered content reveal — short, elegant, transform/opacity only. */
  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { delayChildren: reduce ? 0.05 : 0.5, staggerChildren: reduce ? 0.05 : 0.16 } },
  };
  const fade = (distance: number, blur = false): Variants => ({
    hidden: {
      opacity: 0,
      y: reduce ? 0 : distance,
      ...(blur && !reduce ? { filter: "blur(8px)" } : {}),
      visibility: "hidden",
    },
    visible: {
      opacity: 1,
      y: 0,
      ...(blur && !reduce ? { filter: "blur(0px)" } : {}),
      visibility: "visible",
      transition: { duration: reduce ? 0.3 : 0.65, ease: EASE },
    },
  });

  return (
    <section ref={heroRef} className="relative min-h-[76svh] w-full overflow-hidden bg-ink sm:min-h-[720px] lg:min-h-[calc(100svh-6rem)]" aria-label="معرفی Homeino">
      {/* Background media — immersive, fills the frame on every screen size. */}
      <motion.div style={reduce ? undefined : { y, scale }} className="absolute -inset-y-[8%] inset-x-0 will-change-transform">
        {showVideo ? (
          <video
            ref={videoRef}
            src={HERO_VIDEO}
            autoPlay
            muted
            playsInline
            preload="auto"
            poster={POSTER}
            disablePictureInPicture
            tabIndex={-1}
            onEnded={reveal}
            onError={() => {
              setVideoFailed(true);
              reveal();
            }}
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <SmartImage src={POSTER} alt="فضای داخلی گرم و مدرن" className="h-full w-full" />
        )}
      </motion.div>

      {/* Gradient / brand overlay — appears only after the video ends. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: reduce ? 0.2 : 0.7, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-ink/45 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
        <div className="absolute -right-24 top-1/4 h-72 w-72 bg-[radial-gradient(closest-side,rgba(30,93,68,0.32),transparent)] sm:h-[55vh] sm:w-[55vh]" />
        <div className="absolute -left-24 bottom-0 h-64 w-64 bg-[radial-gradient(closest-side,rgba(185,145,69,0.2),transparent)] sm:h-80 sm:w-80" />
        <div className="grain absolute inset-0 opacity-30" />
      </motion.div>

      {/* Content — fades out gently while scrolling (no layout shift). */}
      <motion.div
        style={reduce ? undefined : { opacity: contentOpacity }}
        className="relative z-10 flex min-h-[76svh] items-center py-14 sm:min-h-[720px] lg:min-h-[calc(100svh-6rem)]"
      >
        <Container>
          <motion.div variants={containerVariants} initial="hidden" animate={revealed ? "visible" : "hidden"} className="max-w-3xl">
            {/* HEADLINE */}
            <motion.div variants={fade(12)}>
              <Badge tone="dark" className="mb-5 border-gold/35 bg-white/10 px-3.5 py-2 text-gold-soft backdrop-blur">
                <Sparkles size={13} /> بازارگاه خانه و طراحی هوشمند
              </Badge>
            </motion.div>
            <motion.h1 variants={fade(26, true)} className="text-balance text-shadow-soft font-display text-[clamp(2.25rem,8vw,5rem)] font-black leading-[1.2] text-cream">
              خانه‌ای بساز که<br />
              <span className="text-gold-gradient">شبیه خودت</span> باشد.
            </motion.h1>

            {/* DESCRIPTION */}
            <motion.p variants={fade(16)} className="mt-5 max-w-2xl text-pretty text-base leading-8 text-cream/78 sm:text-lg sm:leading-9">
              از کشف محصول و مقایسه فروشگاه‌ها تا الهام گرفتن و دیدن نتیجه در فضای واقعی با هوش مصنوعی؛ همه در یک تجربه ساده و مطمئن.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fade(16)} className="mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setSearch(true)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/15 bg-cream/95 px-4 text-right text-ink shadow-[var(--shadow-lift)] backdrop-blur transition hover:bg-cream sm:px-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-cream">
                  <Search size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">دنبال چه چیزی هستی؟</span>
                  <span className="block truncate text-xs text-ink-muted">مبل، فرش، سبک یا فروشگاه…</span>
                </span>
                <ArrowLeft size={18} className="shrink-0 text-terracotta" />
              </button>
              <ButtonLink href="/ai" variant="gold" size="lg" className="min-h-14 rounded-2xl px-5">
                <Wand2 size={18} /> شروع طراحی AI
              </ButtonLink>
            </motion.div>

            {/* TRUST SIGNALS */}
            <motion.div variants={fade(12)} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-cream/72 sm:text-sm">
              <span className="flex items-center gap-1.5">
                <Search size={14} className="text-gold-soft" />
                <b className="text-cream">{toFa(products.length)}</b> محصول منتخب
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-gold-soft" />
                <b className="text-cream">{toFa(stores.length)}</b> فروشگاه معتبر
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-sage-soft" /> ضمانت خرید و بازگشت
              </span>
            </motion.div>
          </motion.div>
        </Container>
      </motion.div>

      {/* Scroll hint — only once the reveal has started. */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.1, duration: 0.6 }}
          className="absolute inset-x-0 bottom-5 z-10 hidden justify-center sm:flex"
        >
          <motion.div
            animate={reduce ? undefined : { y: [0, 7, 0] }}
            transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1 text-cream/50"
          >
            <span className="text-[10px] tracking-[.2em]">کشف کن</span>
            <ChevronDown size={18} />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
