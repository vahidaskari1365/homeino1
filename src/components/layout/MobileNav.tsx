"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Home,
  Search,
  Sparkles,
  Heart,
  ShoppingBag,
  User,
  X,
  Package,
  LayoutGrid,
  Store,
  Lightbulb,
  Palette,
  Tag,
  GitCompare,
  ArrowLeft,
} from "lucide-react";
import { useUi } from "@/stores/useApp";
import { useWishlist, useCart } from "@/stores/useShop";
import { cn, toFa } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const MENU = [
  { label: "همه محصولات", href: "/products", icon: Package },
  { label: "دسته‌بندی‌ها", href: "/category/furniture", icon: LayoutGrid },
  { label: "فروشگاه‌ها", href: "/stores", icon: Store },
  { label: "الهام و ایده", href: "/inspiration", icon: Lightbulb },
  { label: "سبک‌های چیدمان", href: "/styles", icon: Palette },
  { label: "دسته دوم", href: "/second-hand", icon: Tag },
  { label: "علاقه‌مندی‌ها", href: "/wishlist", icon: Heart },
  { label: "مقایسه محصولات", href: "/compare", icon: GitCompare },
  { label: "حساب کاربری", href: "/account", icon: User },
];

const DOCK = [
  { label: "خانه", href: "/", icon: Home, action: null as null | "search" | "ai" },
  { label: "جستجو", href: "#", icon: Search, action: "search" as const },
  { label: "AI", href: "#", icon: Sparkles, action: "ai" as const },
  { label: "علاقه‌مندی", href: "/wishlist", icon: Heart, action: null as null | "search" | "ai" },
  { label: "حساب", href: "/account", icon: User, action: null as null | "search" | "ai" },
];

const overlay: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

const panel: Variants = {
  hidden: { x: "100%" },
  show: { x: "0%", transition: { type: "spring", stiffness: 300, damping: 34 } },
  exit: { x: "100%", transition: { duration: 0.28, ease: [0.7, 0, 0.84, 0] } },
};

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
};

/** Full-screen cinematic drawer + floating glass bottom dock. */
export function MobileNav() {
  const { mobileNavOpen, setMobileNav, setSearch, setAiPanel } = useUi();
  const pathname = usePathname();
  const wish = useWishlist((s) => s.total());
  const cart = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(mobileNavOpen, drawerRef);

  /* Lock body scroll while the drawer is open */
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const close = () => setMobileNav(false);

  const dockAction = (action: "search" | "ai") => {
    if (action === "search") setSearch(true);
    else setAiPanel(true);
  };

  return (
    <>
      {/* ============== FULL-SCREEN DRAWER ============== */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            variants={overlay}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-[110] bg-ink/60 backdrop-blur-md lg:hidden"
            onClick={close}
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              ref={drawerRef}
              variants={panel}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-hidden bg-ivory shadow-[var(--shadow-lift)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ambient glows */}
              <div className="pointer-events-none absolute -left-16 top-24 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />
              <div className="pointer-events-none absolute -right-10 bottom-40 h-40 w-40 rounded-full bg-terracotta/10 blur-3xl" />

              {/* header */}
              <div className="relative flex items-center justify-between border-b border-clay/40 px-5 py-4">
                <span className="font-display text-lg font-black text-ink">
                  Home<span className="text-gold-gradient">ino</span>
                </span>
                <button
                  onClick={close}
                  aria-label="بستن منو"
                  className="grid h-10 w-10 place-items-center rounded-full bg-ink text-cream transition-transform active:scale-90"
                >
                  <X size={19} />
                </button>
              </div>

              {/* nav rows */}
              <motion.nav
                variants={list}
                initial="hidden"
                animate="show"
                className="relative flex-1 overflow-y-auto px-4 py-5"
              >
                <motion.div variants={row} className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  کاوش خانه‌نو
                </motion.div>

                <div className="space-y-1">
                  {MENU.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const badge = item.href === "/wishlist" ? wish : 0;
                    return (
                      <motion.div key={item.href} variants={row}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className={cn(
                            "group flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-bold transition-all duration-300",
                            active
                              ? "bg-ink text-cream shadow-[var(--shadow-soft)]"
                              : "text-ink hover:bg-ivory-2"
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-9 w-9 place-items-center rounded-xl transition-colors",
                              active ? "bg-gold text-ink" : "bg-sand/50 text-terracotta-deep"
                            )}
                          >
                            <Icon size={17} />
                          </span>
                          <span className="flex-1">{item.label}</span>
                          {badge > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-black text-ink">
                              {toFa(badge)}
                            </span>
                          )}
                          <ArrowLeft
                            size={16}
                            className={cn(
                              "transition-all duration-300",
                              active ? "text-gold-soft" : "text-clay group-hover:-translate-x-1 group-hover:text-ink"
                            )}
                          />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.nav>

              {/* AI CTA + cart footer */}
              <motion.div
                variants={list}
                initial="hidden"
                animate="show"
                className="relative space-y-2.5 border-t border-clay/40 p-4"
              >
                <motion.div variants={row}>
                  <Link
                    href="/ai/design"
                    onClick={close}
                    className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-l from-gold to-gold-soft px-4 py-3.5 font-black text-ink shadow-[var(--shadow-gold)]"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex items-center gap-2">
                      <Sparkles size={18} />
                      استودیو طراحی با هوش مصنوعی
                    </span>
                    <ArrowLeft size={18} className="relative" />
                  </Link>
                </motion.div>
                <motion.div variants={row}>
                  <Link
                    href="/cart"
                    onClick={close}
                    className="flex items-center justify-between rounded-2xl border border-clay/50 bg-cream px-4 py-3 text-sm font-bold text-ink transition-colors hover:bg-ivory-2"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag size={17} className="text-terracotta" />
                      سبد خرید
                    </span>
                    {cart > 0 && (
                      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-terracotta px-1.5 text-[11px] font-black text-white">
                        {toFa(cart)}
                      </span>
                    )}
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============== FLOATING GLASS DOCK ============== */}
      <nav className="fixed inset-x-0 bottom-3 z-40 px-4 lg:hidden" aria-label="دسترسی سریع">
        <div className="glass mx-auto flex max-w-md items-stretch justify-around rounded-full border border-gold/20 px-2 py-1.5 shadow-[var(--shadow-lift)]">
          {DOCK.map((it) => {
            const active = pathname === it.href;
            const iconCls = cn(
              "relative grid h-10 w-10 place-items-center rounded-full transition-all duration-300",
              active ? "bg-ink text-cream shadow-[var(--shadow-soft)]" : "text-ink/70"
            );
            const labelCls = cn(
              "text-[10px] transition-colors",
              active ? "font-black text-ink" : "text-ink-muted"
            );

            /* AI — raised golden center button */
            if (it.action === "ai") {
              return (
                <button
                  key={it.label}
                  onClick={() => dockAction("ai")}
                  aria-label="استودیو هوش مصنوعی"
                  className="flex flex-col items-center"
                >
                  <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-gold text-ink shadow-[var(--shadow-gold)] transition-transform active:scale-90">
                    <Sparkles size={23} />
                  </span>
                  <span className="-mt-0.5 text-[10px] font-bold text-ink">{it.label}</span>
                </button>
              );
            }

            /* Search — opens overlay */
            if (it.action === "search") {
              return (
                <button
                  key={it.label}
                  onClick={() => dockAction("search")}
                  aria-label="جستجو"
                  className="flex flex-1 flex-col items-center gap-0.5"
                >
                  <span className={iconCls}>
                    <it.icon size={19} />
                  </span>
                  <span className={labelCls}>{it.label}</span>
                </button>
              );
            }

            /* Route items */
            return (
              <Link
                key={it.label}
                href={it.href}
                aria-label={it.label}
                className="flex flex-1 flex-col items-center gap-0.5"
              >
                <span className={iconCls}>
                  <it.icon size={19} />
                  {it.href === "/wishlist" && wish > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-black text-ink">
                      {toFa(wish)}
                    </span>
                  )}
                </span>
                <span className={labelCls}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
