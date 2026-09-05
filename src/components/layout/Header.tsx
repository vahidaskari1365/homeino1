"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  type Variants,
} from "framer-motion";
import {
  Search,
  Heart,
  GitCompare,
  ShoppingBag,
  User,
  Menu,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  Package,
  LayoutGrid,
  Store,
  Lightbulb,
  Palette,
  Tag,
  ArrowLeft,
  Wand2,
} from "lucide-react";
import { useCart, useWishlist, useCompare } from "@/stores/useShop";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { productsByCategory } from "@/data/products";
import { styles } from "@/data/styles";
import { PLATFORM, formatThreshold } from "@/config/platform";
import { cn, toFa } from "@/lib/utils";
import { Container } from "../ui/primitives";
import { SmartImage } from "../ui/SmartImage";

/* ============================================================
   NAV MODEL
   ============================================================ */
type MegaKey = "products" | "categories" | "styles";

const NAV: { label: string; href: string; mega?: MegaKey; icon: typeof Package }[] = [
  { label: "محصولات", href: "/products", mega: "products", icon: Package },
  { label: "دسته‌بندی‌ها", href: "/category/furniture", mega: "categories", icon: LayoutGrid },
  { label: "فروشگاه‌ها", href: "/stores", icon: Store },
  { label: "الهام", href: "/inspiration", icon: Lightbulb },
  { label: "سبک‌ها", href: "/styles", mega: "styles", icon: Palette },
  { label: "دسته دوم", href: "/second-hand", icon: Tag },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/* ============================================================
   SMALL PIECES
   ============================================================ */
function IconBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative grid place-items-center">
      {children}
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold px-1 text-[10px] font-black text-ink shadow-[0_2px_8px_rgba(190,154,79,0.5)]"
          >
            {toFa(count)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function IconButton({
  href,
  label,
  onClick,
  children,
  className,
}: {
  href?: string;
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = cn(
    "grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/80 transition-all duration-300 hover:bg-ink hover:text-cream hover:shadow-[var(--shadow-soft)] active:scale-90",
    className
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

/* ============================================================
   MEGA MENU — FEATURED AI CARD
   ============================================================ */
function AiFeatureCard() {
  return (
    <Link
      href="/ai/design"
      className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-2xl surface-emerald p-6 text-cream"
    >
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-gold/25 blur-3xl transition-all duration-700 group-hover:bg-gold/40" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-terracotta-soft/30 blur-3xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/15 px-3 py-1 text-[11px] font-bold text-gold-soft">
          <Sparkles size={12} />
          استودیو هوش مصنوعی
        </span>
        <h3 className="mt-4 text-xl font-black leading-7">
          خانه‌ات را با هوش مصنوعی
          <br />
          <span className="text-gold-gradient">طراحی و چیدمان کن</span>
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-cream/70">
          عکس اتاقت را بفرست، چیدمان پیشنهادی بگیر و محصولات هماهنگ با سبکت را همان‌جا کشف کن.
        </p>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <span className="text-[12px] font-medium text-cream/60">
          {toFa(PLATFORM.ai.startingCredits)} اعتبار هدیه برای شروع
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold text-ink shadow-[var(--shadow-gold)] transition-transform duration-300 group-hover:-translate-x-1.5">
          <ArrowLeft size={18} />
        </span>
      </div>
    </Link>
  );
}

/* ============================================================
   MEGA MENU PANELS
   ============================================================ */
function MegaPanel({ mega }: { mega: MegaKey }) {
  if (mega === "categories") {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {categories.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.4, ease: EASE }}
            >
              <Link
                href={`/category/${c.slug}`}
                className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors duration-300 hover:bg-ivory-2"
              >
                <SmartImage
                  src={c.image}
                  alt={c.name}
                  className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-clay/40 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    {c.name}
                    <ChevronLeft
                      size={14}
                      className="-translate-x-1 text-terracotta opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </div>
                  <div className="text-xs text-ink-muted">{toFa(productsByCategory(c.slug).length)} محصول</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <AiFeatureCard />
      </div>
    );
  }

  if (mega === "styles") {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-muted">
            <Palette size={13} className="text-terracotta" />
            سبک‌های دکوراسیون
          </div>
          <div className="flex flex-wrap gap-2">
            {styles.map((s, i) => (
              <motion.div
                key={s.slug}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.03 * i, duration: 0.35, ease: EASE }}
              >
                <Link
                  href={`/styles/${s.slug}`}
                  className="group flex items-center gap-2 rounded-full border border-clay/50 bg-cream/70 py-2 pe-4 ps-2.5 text-sm font-medium text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="flex -space-x-1.5">
                    {s.colorPalette.slice(0, 3).map((col) => (
                      <span
                        key={col.hex}
                        className="h-4 w-4 rounded-full ring-2 ring-cream"
                        style={{ backgroundColor: col.hex }}
                      />
                    ))}
                  </span>
                  {s.name}
                </Link>
              </motion.div>
            ))}
          </div>
          <Link
            href="/styles"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-terracotta-deep transition-all hover:gap-2.5"
          >
            مشاهده همه سبک‌ها
            <ArrowLeft size={15} />
          </Link>
        </div>
        <AiFeatureCard />
      </div>
    );
  }

  /* products */
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
        {categories.slice(0, 6).map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.4, ease: EASE }}
          >
            <Link
              href={`/category/${c.slug}`}
              className="group mb-2 flex items-center gap-1.5 text-sm font-black text-ink transition-colors hover:text-terracotta-deep"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gold transition-transform duration-300 group-hover:scale-150" />
              {c.name}
            </Link>
            <div className="space-y-1.5 ps-3">
              {c.subcategories.slice(0, 4).map((sc) => (
                <Link
                  key={sc.id}
                  href={`/category/${c.slug}?sub=${sc.slug}`}
                  className="block text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  {sc.name}
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      <AiFeatureCard />
    </div>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
const trustItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export function Header() {
  const { setSearch, setMobileNav } = useUi();
  const [mega, setMega] = useState<MegaKey | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Persisted counters read only after hydration — first paint matches SSR,
  // then the real localStorage numbers appear (zero console mismatch).
  const hydrated = useHasHydrated();
  const cartCount = useCart((s) => (hydrated ? s.items.reduce((n, i) => n + i.qty, 0) : 0));
  const wishCount = useWishlist((s) => (hydrated ? s.total() : 0));
  const cmpCount = useCompare((s) => (hydrated ? s.ids.length : 0));

  /* Page scroll progress (RTL: bar grows from the right edge) */
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ⌘K / Ctrl+K opens search; Esc closes mega */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") setMega(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearch]);

  const closeMega = () => {
    setMega(null);
    setHovered(null);
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/" && pathname.startsWith(`${href}/`)) ||
    (href.startsWith("/category/") && pathname.startsWith("/category/"));

  const activeHref = NAV.find((n) => isActive(n.href))?.href ?? null;
  const pillTarget = hovered ?? activeHref;

  return (
    <header
      className="sticky top-0 z-50"
      onMouseLeave={() => {
        setMega(null);
        setHovered(null);
      }}
    >
      {/* ---- Scroll progress ribbon ---- */}
      <motion.div
        style={{ scaleX: progress }}
        className="absolute inset-x-0 top-0 z-50 h-[3px] origin-right bg-gradient-to-l from-terracotta via-gold-soft to-gold shadow-[0_0_12px_rgba(190,154,79,0.7)]"
      />

      {/* ---- Trust bar (collapses on scroll) ---- */}
      <AnimatePresence initial={false}>
        {!scrolled && (
          <motion.div
            key="trust-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="overflow-hidden bg-ink text-cream/85"
          >
            <Container>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
                className="flex h-9 items-center justify-center gap-5 text-[11px] font-medium sm:justify-between"
              >
                <motion.span variants={trustItem} className="hidden items-center gap-1.5 sm:flex">
                  <ShieldCheck size={13} className="text-sage-soft" /> تضمین اصالت کالا
                </motion.span>
                <motion.span variants={trustItem} className="flex items-center gap-1.5">
                  <Truck size={13} className="text-sage-soft" />
                  ارسال رایگان بالای {toFa(formatThreshold(PLATFORM.policies.freeShippingThreshold / 1_000_000))} میلیون تومان
                </motion.span>
                <motion.span variants={trustItem} className="hidden items-center gap-1.5 sm:flex">
                  <RotateCcw size={13} className="text-sage-soft" />
                  {toFa(PLATFORM.policies.returnDays)} روز ضمانت بازگشت
                </motion.span>
                <motion.span variants={trustItem} className="hidden items-center gap-1.5 lg:flex">
                  <Sparkles size={13} className="text-gold-soft" />
                  {toFa(PLATFORM.ai.startingCredits)} اعتبار هدیه هوش مصنوعی
                </motion.span>
              </motion.div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Floating glass command bar ---- */}
      <Container className="pt-2">
        <motion.div
          animate={{ y: scrolled ? 4 : 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-all duration-500 sm:px-4 lg:rounded-full",
            scrolled
              ? "glass border-gold/25 shadow-[var(--shadow-lift)]"
              : "border-clay/30 bg-cream/55 shadow-[var(--shadow-soft)] backdrop-blur-md"
          )}
        >
          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-full ps-1"
            aria-label="Homeino — خانه"
          >
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-ink text-cream transition-transform duration-500 group-hover:rotate-6">
              <span className="font-display text-lg font-black">H</span>
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-l from-gold to-gold-soft" />
            </span>
            <span className="font-display text-xl font-black tracking-tight text-ink">
              Home<span className="text-gold-gradient">ino</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const targeted = pillTarget === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={() => {
                    setHovered(item.href);
                    setMega(item.mega ?? null);
                  }}
                  className="relative rounded-full px-3 py-2 text-[13px] font-semibold 2xl:px-3.5"
                >
                  {targeted && (
                    <motion.span
                      layoutId="nav-hover-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-ink shadow-[var(--shadow-soft)]"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex items-center gap-1.5 transition-colors duration-300",
                      targeted ? "text-cream" : "text-ink/75 hover:text-ink"
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn(
                        "hidden transition-colors duration-300 2xl:block",
                        targeted ? "text-gold-soft" : "text-terracotta-soft"
                      )}
                    />
                    <span>{item.label}</span>
                    {item.mega && (
                      <ChevronDown
                        size={12}
                        className={cn(
                          "opacity-50 transition-transform duration-300",
                          mega === item.mega && "rotate-180"
                        )}
                      />
                    )}
                  </span>
                </Link>
              );
            })}

            {/* AI Studio — golden CTA */}
            <Link
              href="/ai/design"
              onMouseEnter={() => setMega(null)}
              className="group relative ms-1 flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-l from-gold to-gold-soft px-4 py-2 text-[13px] font-black text-ink shadow-[var(--shadow-gold)] transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Wand2 size={14} className="relative z-10" />
              <span className="relative z-10">استودیو AI</span>
              <span className="relative z-10 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/40" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink" />
              </span>
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Search with ⌘K hint */}
            <button
              onClick={() => setSearch(true)}
              className="group me-0.5 flex h-10 items-center gap-2 rounded-full border border-clay/50 bg-cream/80 ps-3.5 pe-2 text-ink-muted transition-all duration-300 hover:border-terracotta/50 hover:text-ink sm:pe-3"
              aria-label="جستجو"
            >
              <Search size={16} className="transition-transform duration-300 group-hover:scale-110" />
              <span className="hidden text-[12px] xl:inline">جستجو در خانه‌نو…</span>
              <kbd className="hidden place-items-center rounded-md border border-clay/60 bg-ivory-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted xl:grid">
                ⌘K
              </kbd>
            </button>

            <IconButton href="/wishlist" label="علاقه‌مندی‌ها" className="hidden sm:grid">
              <IconBadge count={wishCount}>
                <Heart size={18} />
              </IconBadge>
            </IconButton>
            <IconButton href="/compare" label="مقایسه محصولات" className="hidden xl:grid">
              <IconBadge count={cmpCount}>
                <GitCompare size={18} />
              </IconBadge>
            </IconButton>
            <IconButton href="/cart" label="سبد خرید">
              <IconBadge count={cartCount}>
                <ShoppingBag size={18} />
              </IconBadge>
            </IconButton>
            <IconButton href="/account" label="حساب کاربری" className="hidden sm:grid">
              <User size={18} />
            </IconButton>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileNav(true)}
              aria-label="باز کردن منو"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-all duration-300 hover:bg-ink hover:text-cream active:scale-90 lg:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
        </motion.div>
      </Container>

      {/* ---- Mega menu (desktop) ---- */}
      <AnimatePresence>
        {mega && (
          <motion.div
            key={mega}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.16 } }}
            transition={{ duration: 0.32, ease: EASE }}
            className="absolute inset-x-0 top-full hidden lg:block"
            onMouseLeave={closeMega}
          >
            {/* hover bridge — keeps the panel alive between nav and panel */}
            <div className="absolute inset-x-0 -top-4 h-4" onMouseEnter={() => setMega(mega)} />
            <Container>
              <div className="glass mt-2 overflow-hidden rounded-3xl border border-gold/20 p-5 shadow-[var(--shadow-lift)] sm:p-6">
                <MegaPanel mega={mega} />
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
