"use client";
// ============================================================
// HomeHero — the ONLY interactive island of the home page.
//
// Everything below the hero (categories, styles, collections,
// trends, magazine, stores, CTA) is rendered by the server
// component `src/app/page.tsx`; this client boundary exists
// purely because the cinematic intro hero needs:
//   • the intro stage machine (video solo → halo → copy)
//   • the autoplay-resilient <video> controller
//   • scroll-linked parallax (framer-motion useScroll)
// Counts are passed as props so the big product/store data
// arrays never enter the client bundle just for two numbers.
// ============================================================
import Link from "next/link";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Sparkles, Wand2, ChevronDown, Users, ShieldCheck, X } from "lucide-react";
import { Container, Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const HERO_VIDEO = "/video/01.mp4";
const HERO_POSTER = "/video/hero-poster.jpg";

// Effects that must run BEFORE the browser's first paint (SSR-safe wrapper).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function HomeHero({ productCount, storeCount }: { productCount: number; storeCount: number }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Hero intro stage machine: 0 = video plays alone → 1 = halo fades in →
  // 2 = copy enters. SSR renders stage 0 (video alone) so the very first
  // paint is already the clean intro — no halo flash before hydration.
  // Users who skip the intro (data-saver / reduced-motion / no video) are
  // moved to stage 2 before first paint by the layout effect below.
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const ready = stage >= 2;

  // Skip affordance (button shown while the video plays solo): pauses the
  // video and runs the SAME halo → copy sequence, just sooner.
  const skipIntro = () => {
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
    if (stage >= 1) return;
    setStage(1);
    window.setTimeout(() => setStage((s) => (s < 2 ? 2 : s)), 850);
  };

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scaleBg = useTransform(scrollYProgress, [0, 1], [1.08, 1.22]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useIsoLayoutEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let cancelled = false;
    const timers: number[] = [];

    // Data-saver users: never pull the 311KB stream on metered connections —
    // cancel the attribute-autoplay before it starts and reveal the halo +
    // copy over the static poster after a short beat, so the hero is never
    // an empty poster. (Reduced-motion intentionally follows the NORMAL
    // sequence now: the intro is the site's centerpiece, every reveal is a
    // gentle opacity fade and a skip button is one tap away. The old
    // instant-skip to stage 2 was exactly the bug that flashed the halo
    // before the video on desktops with "reduce motion" enabled — the halo
    // must never be visible until the video has played, on ANY device.)
    if (window.matchMedia?.("(prefers-reduced-data: reduce)")?.matches) {
      try {
        v.removeAttribute("autoplay");
        v.pause();
      } catch {
        // ignore
      }
      setStage((s) => (s < 1 ? 1 : s));
      timers.push(window.setTimeout(() => setStage((s) => (s < 2 ? 2 : s)), 900));
      return () => {
        cancelled = true;
        timers.forEach((t) => window.clearTimeout(t));
      };
    }

    // Ensure attributes are set for maximum autoplay compatibility on mobile
    try {
      v.defaultMuted = true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("muted", "");
    } catch {
      // ignore
    }

    let hasPlayed = false;
    let finished = false;

    // Video finished (or a safety net fired): the halo fades in first, the
    // copy follows ~0.85s later. Idempotent — once shown, the copy is never
    // hidden again, no matter what the video does afterwards.
    const finishIntro = () => {
      if (finished || cancelled) return;
      finished = true;
      setStage((s) => (s < 1 ? 1 : s));
      timers.push(window.setTimeout(() => setStage((s) => (s < 2 ? 2 : s)), 850));
    };

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

    // Silent retry loop: on mobile networks the first play() call can land
    // before any data is buffered, some browsers reject it and never re-fire
    // canplay. Retry quietly every 400ms (max ~8s) until playback starts.
    let tries = 0;
    const retry = window.setInterval(() => {
      if (cancelled || !v.paused || tries++ > 20) {
        window.clearInterval(retry);
        return;
      }
      v.play().catch(() => {});
    }, 400);

    const onEnded = () => finishIntro();
    const onError = () => finishIntro();

    // "Playback actually started" marker. NOTE: the native autoPlay attribute
    // can start the video BEFORE React hydrates, so the one-shot `playing`
    // event may fire before we listen. `timeupdate` fires every ~250ms during
    // playback, and the paused/currentTime probe below catches playback that
    // already began — together they make `hasPlayed` reliable.
    const markPlaying = () => {
      if (hasPlayed) return;
      hasPlayed = true;
      window.clearInterval(retry);
    };
    const onTimeUpdate = () => markPlaying();
    const onPlayingEvt = () => markPlaying();
    if (!v.paused || v.currentTime > 0) markPlaying();

    v.addEventListener("loadeddata", tryPlay);
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("playing", onPlayingEvt);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);

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

    // Coming back to the tab is another autoplay window on some browsers.
    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Safety nets — the copy must never be trapped behind a video that cannot
    // play (blocked autoplay, dead stream, throttled tab): if playback hasn't
    // started within 4.5s we show halo + copy anyway; 12s is a hard cap.
    timers.push(window.setTimeout(() => {
      if (!hasPlayed) finishIntro();
    }, 4500));
    timers.push(window.setTimeout(() => finishIntro(), 12000));

    return () => {
      cancelled = true;
      window.clearInterval(retry);
      timers.forEach((t) => window.clearTimeout(t));
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("playing", onPlayingEvt);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("touchstart", resumePlayback);
      window.removeEventListener("pointerdown", resumePlayback);
    };
  }, []);

  return (
    <section ref={heroRef} className="relative h-auto min-h-[60vh] sm:h-[100svh] sm:min-h-[640px] w-full overflow-hidden bg-ink">
      {/* parallax background (video) */}
      <motion.div style={{ y: yBg, scale: scaleBg }} className="absolute inset-0">
        <video
          id="hero-video"
          ref={(el) => {
            videoRef.current = el;
            // `muted` must hold BEFORE the browser's autoplay decision.
            // React 19 does render the muted attribute into the SSR HTML,
            // and this ref callback re-asserts the property at commit time
            // so muted inline playback is granted on iOS Safari and
            // Android Chrome alike — no native play button on phones.
            if (el) {
              el.defaultMuted = true;
              el.muted = true;
            }
          }}
          src={HERO_VIDEO}
          autoPlay
          muted
          playsInline
          webkit-playsinline="true"
          // poster + metadata-only preload: LCP comes from the 68KB poster,
          // the 311KB video streams in afterwards (was 3.6MB preload=auto
          // which starved the hero intro on mobile).
          preload="metadata"
          disablePictureInPicture
          aria-hidden="true"
          poster={HERO_POSTER}
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* halo pass — legibility gradients + green/gold aurora glows + grain.
          Hidden while the video plays alone (stage 0); fades in once the
          video ends (stage 1), before the copy enters (stage 2). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity ease-out ${stage >= 1 ? "opacity-100 duration-[1400ms]" : "opacity-0 duration-300"}`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-transparent to-ink/40" />
        {/* aurora glow */}
        <div className="pointer-events-none absolute -right-32 top-1/4 h-[60vh] w-[60vh] rounded-full bg-terracotta/30 blur-[120px] animate-[aurora_14s_ease-in-out_infinite_alternate]" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-[50vh] w-[50vh] rounded-full bg-gold/15 blur-[120px]" />
        <div className="absolute inset-0 grain opacity-40" />
      </div>

      {/* copy — enters after the video ends and the halo has landed (stage 2) */}
      <motion.div style={{ opacity }} className="relative z-10 flex h-full flex-col justify-center">
        <Container className="py-10 px-4 sm:px-0">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={ready ? { duration: 0.7 } : { duration: 0 }}>
              <Badge tone="dark" className="mb-6 border-gold/30 bg-white/10 px-4 py-1.5 text-gold-soft backdrop-blur">
                <Sparkles size={13} /> خانه · دکوراسیون · هومینو استودیو
              </Badge>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 28, filter: "blur(12px)" }} animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 28, filter: "blur(12px)" }} transition={ready ? ({ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] } as any) : { duration: 0 }} className="mt-3 font-display text-4xl font-black leading-tight text-cream sm:text-6xl">
              خانه ایی که <span className="text-gold-gradient">شبیه توست</span> ، همین جا آغاز می شود
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={ready ? { duration: 0.9, delay: 0.35 } : { duration: 0 }} className="mt-5 max-w-xl text-base sm:text-lg leading-7 sm:leading-8 text-cream/80">
              سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={ready ? { duration: 0.9, delay: 0.45 } : { duration: 0 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-cream px-6 py-3 font-bold text-ink transition hover:translate-y-[-2px] hover:shadow-gold">
                <Search size={18} /> کشف محصولات
              </Link>
              <Link href="/ai/design" className="inline-flex items-center justify-center gap-2 rounded-xl border border-cream/30 px-5 py-3 font-medium text-cream transition hover:bg-white/10">
                <Wand2 size={18} /> طراحی فضای من با هومینو استودیو
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : { opacity: 0 }} transition={ready ? { duration: 1, delay: 0.65 } : { duration: 0 }} className="mt-8 flex flex-wrap items-center gap-4 text-sm text-cream/70">
              <span className="flex items-center gap-1.5"><Search size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(productCount)}</b> محصول منتخب</span>
              <span className="hidden text-cream/30 sm:inline">|</span>
              <span className="flex items-center gap-1.5"><Users size={15} className="text-gold-soft" /> <b className="text-cream">{toFa(storeCount)}</b> فروشگاه معتبر</span>
              <span className="hidden text-cream/30 sm:inline">|</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-sage-soft" /> خرید امن با ضمانت بازگشت</span>
            </motion.div>
          </div>
        </Container>
      </motion.div>

      {/* skip intro (only while the video plays solo) */}
      <button
        type="button"
        onClick={skipIntro}
        className={`absolute bottom-6 left-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-cream/25 bg-ink/45 px-3.5 py-1.5 text-xs font-bold text-cream/85 backdrop-blur transition duration-500 hover:bg-ink/70 hover:text-cream ${stage === 0 ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <X size={13} /> رد کردن ویدیو
      </button>

      {/* scroll indicator — appears together with the copy */}
      <div className={`absolute inset-x-0 bottom-6 z-10 flex justify-center transition-opacity duration-700 ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="flex flex-col items-center gap-1 text-cream/50">
          <span className="text-2xs tracking-widest">اسکرول کن</span>
          <ChevronDown size={18} />
        </motion.div>
      </div>
    </section>
  );
}
