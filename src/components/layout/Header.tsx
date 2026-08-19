"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Heart, GitCompare, ShoppingBag, User, Menu, Sparkles, ChevronDown, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { useCart, useWishlist, useCompare } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { PLATFORM, formatThreshold } from "@/config/platform";
import { cn, toFa } from "@/lib/utils";
import { Container } from "../ui/primitives";

const NAV = [
  { label: "محصولات", href: "/products", mega: "products" },
  { label: "دسته‌بندی‌ها", href: "/category/furniture", mega: "categories" },
  { label: "فروشگاه‌ها", href: "/stores" },
  { label: "الهام", href: "/inspiration" },
  { label: "سبک‌ها", href: "/styles", mega: "styles" },
  { label: "دسته دوم", href: "/second-hand" },
  { label: "طراحی هوشمند", href: "/ai", accent: true },
];

function IconBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative">
      {children}
      {count > 0 && <span className="absolute -right-2 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-cream bg-terracotta px-0.5 text-[9px] font-black text-white">{toFa(count)}</span>}
    </span>
  );
}

export function Header() {
  const { setSearch, setMobileNav } = useUi();
  const pathname = usePathname();
  const [mega, setMega] = useState<string | null>(null);
  const cartCount = useCart((state) => state.items.reduce((count, item) => count + item.qty, 0));
  const wishCount = useWishlist((state) => state.total());
  const compareCount = useCompare((state) => state.ids.length);

  return (
    <header className="sticky top-0 z-50 border-b border-clay/35 glass" onMouseLeave={() => setMega(null)}>
      <div className="bg-ink text-cream/88">
        <Container>
          <div className="flex h-8 min-w-0 items-center justify-center gap-4 text-[10px] font-medium sm:justify-between sm:text-[11px]">
            <span className="hidden items-center gap-1.5 sm:flex"><ShieldCheck size={12} className="text-sage-soft" /> تضمین اصالت کالا</span>
            <span className="flex min-w-0 items-center gap-1.5"><Truck size={12} className="shrink-0 text-sage-soft" /><span className="truncate">ارسال رایگان بالای {toFa(formatThreshold(PLATFORM.policies.freeShippingThreshold / 1_000_000))} میلیون تومان</span></span>
            <span className="hidden items-center gap-1.5 md:flex"><RotateCcw size={12} className="text-sage-soft" /> {toFa(PLATFORM.policies.returnDays)} روز ضمانت بازگشت</span>
            <span className="hidden items-center gap-1.5 xl:flex"><Sparkles size={12} className="text-gold-soft" /> {toFa(PLATFORM.ai.startingCredits)} اعتبار هدیه شروع</span>
          </div>
        </Container>
      </div>

      <Container>
        <div className="flex h-16 min-w-0 items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Homeino، صفحه اصلی">
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[13px] bg-ink text-cream shadow-[var(--shadow-soft)]">
              <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-l from-gold to-terracotta-soft" />
              <span className="font-display text-lg font-black">H</span>
            </span>
            <span className="hidden font-display text-xl font-black tracking-tight text-ink min-[375px]:inline">Home<span className="text-terracotta">ino</span></span>
          </Link>

          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-0.5 xl:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setMega(item.mega ?? null)}
                  onFocus={() => setMega(item.mega ?? null)}
                  aria-current={active ? "page" : undefined}
                  aria-expanded={item.mega ? mega === item.mega : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-1 rounded-lg px-2.5 py-2 text-[13px] font-bold transition",
                    active ? "bg-ivory-2 text-ink" : item.accent ? "text-terracotta-deep hover:bg-terracotta/8" : "text-ink-muted hover:bg-ivory-2 hover:text-ink",
                  )}
                >
                  {item.label}{item.accent && <Sparkles size={13} />}{item.mega && <ChevronDown size={13} className="opacity-50" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <button onClick={() => setSearch(true)} className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-clay/50 bg-cream/75 px-3 text-sm text-ink-muted transition hover:border-terracotta hover:text-ink xl:min-w-44 xl:justify-start" aria-label="باز کردن جستجو">
              <Search size={18} className="shrink-0" /><span className="hidden truncate xl:inline">جستجوی محصول و سبک…</span>
            </button>
            <Link href="/wishlist" className="icon-button hidden text-ink-muted transition hover:bg-ivory-2 hover:text-ink sm:grid" aria-label="علاقه‌مندی‌ها"><IconBadge count={wishCount}><Heart size={19} /></IconBadge></Link>
            <Link href="/compare" className="icon-button hidden text-ink-muted transition hover:bg-ivory-2 hover:text-ink lg:grid" aria-label="مقایسه"><IconBadge count={compareCount}><GitCompare size={19} /></IconBadge></Link>
            <Link href="/cart" className="icon-button text-ink-muted transition hover:bg-ivory-2 hover:text-ink" aria-label="سبد خرید"><IconBadge count={cartCount}><ShoppingBag size={19} /></IconBadge></Link>
            <Link href="/account" className="icon-button hidden text-ink-muted transition hover:bg-ivory-2 hover:text-ink sm:grid" aria-label="حساب کاربری"><User size={19} /></Link>
            <button onClick={() => setMobileNav(true)} className="icon-button text-ink transition hover:bg-ivory-2 xl:hidden" aria-label="باز کردن منو"><Menu size={22} /></button>
          </div>
        </div>
      </Container>

      {mega && (
        <div className="absolute inset-x-0 top-full hidden border-b border-clay/35 bg-cream/98 shadow-[var(--shadow-card)] xl:block" onMouseEnter={() => setMega(mega)}>
          <div className="absolute inset-x-0 -top-3 h-3" />
          <Container className="py-6">
            {mega === "categories" && <div className="grid grid-cols-3 gap-2">{categories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-ivory-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sand/45 font-black text-ink">{category.name[0]}</span><div><div className="text-sm font-bold text-ink">{category.name}</div><div className="text-xs text-ink-muted">{toFa(category.productCount)} محصول</div></div></Link>)}</div>}
            {mega === "styles" && <div className="flex flex-wrap gap-2">{styles.map((style) => <Link key={style.slug} href={`/styles/${style.slug}`} className="rounded-full border border-clay/55 px-4 py-2 text-sm font-medium text-ink transition hover:border-terracotta hover:bg-ivory-2">{style.name}</Link>)}</div>}
            {mega === "products" && <div className="grid grid-cols-4 gap-3 text-sm">{categories.slice(0, 8).flatMap((category) => category.subcategories.slice(0, 1).map((subcategory) => <Link key={subcategory.id} href={`/category/${category.slug}?sub=${subcategory.slug}`} className="rounded-lg px-2 py-2 text-ink-muted transition hover:bg-ivory-2 hover:text-ink">{category.name} <span className="opacity-40">←</span> {subcategory.name}</Link>))}</div>}
          </Container>
        </div>
      )}
    </header>
  );
}
