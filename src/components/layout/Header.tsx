"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Heart, GitCompare, ShoppingBag, User, Menu, Sparkles, ChevronDown, ShieldCheck, Truck, RotateCcw, Package, LayoutGrid, Store, Lightbulb, Palette, Tag } from "lucide-react";
import { useCart, useWishlist, useCompare } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { styles } from "@/data/styles";
import { PLATFORM, formatThreshold } from "@/config/platform";
import { cn, toFa } from "@/lib/utils";
import { Container } from "../ui/primitives";

const NAV = [
  { label: "محصولات", href: "/products", mega: "products", icon: Package },
  { label: "دسته‌بندی‌ها", href: "/category/furniture", mega: "categories", icon: LayoutGrid },
  { label: "فروشگاه‌ها", href: "/stores", icon: Store },
  { label: "الهام", href: "/inspiration", icon: Lightbulb },
  { label: "سبک‌ها", href: "/styles", mega: "styles", icon: Palette },
  { label: "دسته دوم", href: "/second-hand", icon: Tag },
  { label: "AI استودیو", href: "/ai/design", accent: true, icon: Sparkles },
];

function IconBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative">
      {children}
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
          {toFa(count)}
        </span>
      )}
    </span>
  );
}

export function Header() {
  const { setSearch, setMobileNav } = useUi();
  const [mega, setMega] = useState<string | null>(null);
  const pathname = usePathname();
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wishCount = useWishlist((s) => s.total());
  const cmpCount = useCompare((s) => s.ids.length);

  return (
    <header className="sticky top-0 z-50 border-b border-clay/40 glass" onMouseLeave={() => setMega(null)}>
      {/* Trust bar — conversion psychology: reciprocity + trust + authority */}
      <div className="bg-ink text-cream/90">
        <Container>
          <div className="flex h-8 items-center justify-center gap-4 text-[11px] font-medium sm:justify-between">
          <span className="hidden items-center gap-1.5 sm:flex"><ShieldCheck size={12} className="text-sage-soft" /> تضمین اصالت کالا</span>
          <span className="flex items-center gap-1.5"><Truck size={12} className="text-sage-soft" /> ارسال رایگان بالای {toFa(formatThreshold(PLATFORM.policies.freeShippingThreshold / 1_000_000))} میلیون</span>
          <span className="hidden items-center gap-1.5 sm:flex"><RotateCcw size={12} className="text-sage-soft" /> {toFa(PLATFORM.policies.returnDays)} روز ضمانت بازگشت</span>
          <span className="hidden items-center gap-1.5 lg:flex"><Sparkles size={12} className="text-gold-soft" /> {toFa(PLATFORM.ai.startingCredits)} اعتبار هدیه اول</span>
          </div>
        </Container>
      </div>
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream">
              <span className="font-display text-lg font-black">H</span>
            </span>
            <span className="font-display text-xl font-black tracking-tight text-ink">
              Home<span className="text-terracotta-deep">ino</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
                (item.href.startsWith("/category/") && pathname.startsWith("/category/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setMega(item.mega ?? null)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all duration-300",
                    active
                      ? "bg-ink text-cream shadow-[var(--shadow-soft)]"
                      : item.accent
                        ? "border border-gold/30 bg-gold/10 text-terracotta-deep hover:border-gold/60 hover:bg-gold/20"
                        : "text-ink/75 hover:bg-ivory-2/80 hover:text-ink hover:shadow-[var(--shadow-soft)]"
                  )}
                >
                  <Icon
                    size={14}
                    className={cn(
                      "transition-colors duration-300",
                      active ? "text-gold-soft" : item.accent ? "text-terracotta" : "text-terracotta-soft group-hover:text-terracotta"
                    )}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-l from-gold-soft to-transparent" />
                  )}
                  {item.accent && !active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
                    </span>
                  )}
                  {item.mega && <ChevronDown size={13} className="opacity-45 transition-transform duration-300 group-hover:rotate-180" />}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearch(true)}
              className="flex items-center gap-2 rounded-xl border border-clay/60 bg-cream px-3 py-2 text-sm text-ink-muted transition hover:border-ink hover:text-ink"
            >
              <Search size={17} />
              <span className="hidden xl:inline">جستجو در میان هزاران محصول…</span>
            </button>
            <Link href="/wishlist" className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-ivory-2" aria-label="علاقه‌مندی">
              <IconBadge count={wishCount}><Heart size={19} /></IconBadge>
            </Link>
            <Link href="/compare" className="hidden h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-ivory-2 sm:grid" aria-label="مقایسه">
              <IconBadge count={cmpCount}><GitCompare size={19} /></IconBadge>
            </Link>
            <Link href="/cart" className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-ivory-2" aria-label="سبد خرید">
              <IconBadge count={cartCount}><ShoppingBag size={19} /></IconBadge>
            </Link>
            <Link href="/account" className="hidden h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-ivory-2 sm:grid" aria-label="حساب کاربری">
              <User size={19} />
            </Link>
            <button onClick={() => setMobileNav(true)} className="grid h-10 w-10 place-items-center rounded-xl text-ink lg:hidden" aria-label="منو">
              <Menu size={22} />
            </button>
          </div>
        </div>
      </Container>

      {/* Mega menu */}
      {mega && (
        <div className="absolute inset-x-0 top-full hidden border-b border-clay/40 bg-cream shadow-[var(--shadow-card)] lg:block" onMouseEnter={() => setMega(mega)}>
          {/* invisible hover bridge: prevents the dropdown from closing when moving the cursor from nav to panel */}
          <div className="absolute inset-x-0 -top-3 h-3" />
          <Container className="py-6">
            {mega === "categories" && (
              <div className="grid grid-cols-3 gap-3">
                {categories.map((c) => (
                  <Link key={c.id} href={`/category/${c.slug}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-ivory-2">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-sand/60 text-ink">{c.name[0]}</span>
                    <div>
                      <div className="text-sm font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-muted">{toFa(c.productCount)} محصول</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {mega === "styles" && (
              <div className="flex flex-wrap gap-2">
                {styles.map((s) => (
                  <Link key={s.slug} href={`/styles/${s.slug}`} className="rounded-full border border-clay/60 px-4 py-1.5 text-sm text-ink transition hover:border-ink hover:bg-ivory-2">
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
            {mega === "products" && (
              <div className="grid grid-cols-4 gap-3 text-sm">
                {categories.slice(0, 8).flatMap((c) =>
                  c.subcategories.slice(0, 1).map((sc) => (
                    <Link key={sc.id} href={`/category/${c.slug}?sub=${sc.slug}`} className="text-ink-muted transition hover:text-ink">{c.name} › {sc.name}</Link>
                  ))
                )}
              </div>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}
