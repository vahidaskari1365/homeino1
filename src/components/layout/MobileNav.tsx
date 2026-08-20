"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Sparkles, Heart, User, X } from "lucide-react";
import { useUi } from "@/stores/useApp";
import { useWishlist, useCompare, useCart } from "@/stores/useShop";
import { cn, toFa } from "@/lib/utils";

const items = [
  { label: "خانه", href: "/", icon: Home },
  { label: "جستجو", href: "#search", icon: Search },
  { label: "AI", href: "#ai", icon: Sparkles },
  { label: "علاقه‌مندی", href: "/wishlist", icon: Heart },
  { label: "حساب", href: "/account", icon: User },
];

/** Slide-in drawer for hamburger + persistent bottom bar. */
export function MobileNav() {
  const { mobileNavOpen, setMobileNav, setSearch, setAiPanel } = useUi();
  const pathname = usePathname();
  const wish = useWishlist((s) => s.total());
  const cmp = useCompare((s) => s.ids.length);
  const cart = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

  const handle = (href: string) => {
    if (href === "#search") setSearch(true);
    else if (href === "#ai") setAiPanel(true);
  };

  return (
    <>
      {/* Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[110] bg-ink/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-cream p-5 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-black text-ink">Home<span className="text-terracotta-deep">ino</span></span>
              <button onClick={() => setMobileNav(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ivory-2"><X size={20} /></button>
            </div>
            <nav className="space-y-1">
              {[["خانه", "/"], ["همه محصولات", "/products"], ["دسته‌بندی‌ها", "/category/furniture"], ["فروشگاه‌ها", "/stores"], ["الهام", "/inspiration"], ["معرفی سبک‌ها", "/styles"], ["AI استودیو", "/ai/design"], ["مقایسه", "/compare"], ["علاقه‌مندی", "/wishlist"], ["سبد خرید", "/cart"], ["حساب کاربری", "/account"], ["پنل فروشنده", "/vendor"], ["پنل مدیریت", "/admin"]].map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setMobileNav(false)} className={cn("block rounded-lg px-3 py-2.5 text-sm font-medium transition", pathname === href ? "bg-ink text-cream" : "text-ink hover:bg-ivory-2")}>{label}</Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom bar (mobile only) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-clay/40 glass lg:hidden">
        <div className="flex items-center justify-around px-2 py-1.5">
          {items.map((it) => {
            const active = pathname === it.href;
            const badge = it.href === "/wishlist" ? wish : 0;
            return (
              <button
                key={it.label}
                onClick={() => (it.href.startsWith("#") ? handle(it.href) : undefined)}
                className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5"
              >
                {it.href.startsWith("#") ? (
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream", it.href === "#ai" && "bg-terracotta")}><it.icon size={19} /></span>
                ) : (
                  <span className={cn("relative", active ? "text-ink" : "text-ink-muted")}><it.icon size={21} />
                    {badge > 0 && <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[9px] font-bold text-white">{toFa(badge)}</span>}
                  </span>
                )}
                <span className={cn("text-[10px]", active ? "font-bold text-ink" : "text-ink-muted")}>{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
