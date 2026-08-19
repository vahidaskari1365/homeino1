"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Search, Sparkles, Heart, User, Grid2X2, Store, Lightbulb,
  Palette, GitCompare, ShoppingBag, LayoutDashboard, Shield, PackageSearch,
} from "lucide-react";
import { useUi } from "@/stores/useApp";
import { useWishlist, useCompare, useCart } from "@/stores/useShop";
import { cn, toFa } from "@/lib/utils";
import { Drawer } from "../ui/primitives";

const drawerGroups = [
  {
    label: "کاوش",
    items: [
      { label: "همه محصولات", href: "/products", icon: Grid2X2 },
      { label: "دسته‌بندی‌ها", href: "/category/furniture", icon: PackageSearch },
      { label: "فروشگاه‌ها", href: "/stores", icon: Store },
      { label: "الهام", href: "/inspiration", icon: Lightbulb },
      { label: "سبک‌ها", href: "/styles", icon: Palette },
    ],
  },
  {
    label: "فضای من",
    items: [
      { label: "طراحی هوشمند", href: "/ai", icon: Sparkles },
      { label: "مقایسه", href: "/compare", icon: GitCompare },
      { label: "علاقه‌مندی‌ها", href: "/wishlist", icon: Heart },
      { label: "سبد خرید", href: "/cart", icon: ShoppingBag },
      { label: "حساب کاربری", href: "/account", icon: User },
    ],
  },
  {
    label: "پنل‌ها",
    items: [
      { label: "پنل فروشنده", href: "/vendor", icon: LayoutDashboard },
      { label: "پنل مدیریت", href: "/admin", icon: Shield },
    ],
  },
];

function Count({ value }: { value: number }) {
  if (!value) return null;
  return <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[9px] font-black text-white">{toFa(value)}</span>;
}

export function MobileNav() {
  const { mobileNavOpen, setMobileNav, setSearch } = useUi();
  const pathname = usePathname();
  const wishCount = useWishlist((state) => state.total());
  const compareCount = useCompare((state) => state.ids.length);
  const cartCount = useCart((state) => state.items.reduce((count, item) => count + item.qty, 0));

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <Drawer open={mobileNavOpen} onClose={() => setMobileNav(false)} title="منوی Homeino">
        <div className="mb-5 rounded-2xl surface-emerald p-4 text-cream">
          <div className="flex items-center gap-2 text-sm font-black"><ShoppingBag size={16} className="text-gold-soft" /> همه‌چیز برای خانه‌ات، یک‌جا</div>
          <p className="mt-1 text-xs leading-6 text-cream/65">کشف محصول، مقایسه فروشگاه‌ها و خرید مطمئن — با طراحی هوشمند در کنارش.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/products" onClick={() => setMobileNav(false)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-cream px-3 text-xs font-bold text-ink"><Store size={14} /> کاوش محصولات</Link>
            <Link href="/ai" onClick={() => setMobileNav(false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-ink/30 px-3 text-xs font-bold text-cream"><Sparkles size={14} /> طراحی AI</Link>
          </div>
        </div>

        <nav aria-label="منوی موبایل" className="space-y-6">
          {drawerGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-2 text-[11px] font-bold tracking-wider text-ink-muted">{group.label}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const count = item.href === "/wishlist" ? wishCount : item.href === "/compare" ? compareCount : item.href === "/cart" ? cartCount : 0;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition", active ? "bg-ink text-cream shadow-sm" : "text-ink-muted hover:bg-ivory-2 hover:text-ink")}>
                      <item.icon size={18} /><span className="flex-1">{item.label}</span>{count > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[10px]", active ? "bg-white/15" : "bg-terracotta/10 text-terracotta-deep")}>{toFa(count)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </Drawer>

      <nav aria-label="ناوبری سریع موبایل" className="fixed inset-x-0 bottom-0 z-40 border-t border-clay/35 glass lg:hidden">
        <div className="mx-auto flex max-w-md items-end justify-around px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px]", pathname === "/" ? "font-bold text-ink" : "text-ink-muted")}><Home size={20} /><span>خانه</span></Link>
          <button type="button" onClick={() => setSearch(true)} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] text-ink-muted"><Search size={20} /><span>جستجو</span></button>
<Link href="/products" aria-current={pathname.startsWith("/products") || pathname.startsWith("/category") ? "page" : undefined} className="relative -mt-5 flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[10px] font-bold text-terracotta-deep"><span className="grid h-12 w-12 place-items-center rounded-2xl border-4 border-ivory bg-ink text-cream shadow-[var(--shadow-card)]"><Grid2X2 size={20} /></span><span>محصولات</span></Link>
          <Link href="/wishlist" aria-current={pathname.startsWith("/wishlist") ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px]", pathname.startsWith("/wishlist") ? "font-bold text-ink" : "text-ink-muted")}><span className="relative"><Heart size={20} /><Count value={wishCount} /></span><span>علاقه‌مندی</span></Link>
          <Link href="/account" aria-current={pathname.startsWith("/account") ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px]", pathname.startsWith("/account") ? "font-bold text-ink" : "text-ink-muted")}><User size={20} /><span>حساب</span></Link>
        </div>
      </nav>
    </>
  );
}
