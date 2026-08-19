"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Home } from "lucide-react";
import { Container } from "@/components/ui/primitives";

interface RouteContext {
  parentHref: string;
  parentLabel: string;
  currentLabel: string;
}

const exact: Record<string, RouteContext> = {
  "/products": { parentHref: "/", parentLabel: "خانه", currentLabel: "محصولات" },
  "/stores": { parentHref: "/", parentLabel: "خانه", currentLabel: "فروشگاه‌ها" },
  "/styles": { parentHref: "/", parentLabel: "خانه", currentLabel: "سبک‌ها" },
  "/inspiration": { parentHref: "/", parentLabel: "خانه", currentLabel: "الهام" },
  "/search": { parentHref: "/", parentLabel: "خانه", currentLabel: "جستجو" },
  "/cart": { parentHref: "/products", parentLabel: "محصولات", currentLabel: "سبد خرید" },
  "/checkout": { parentHref: "/cart", parentLabel: "سبد خرید", currentLabel: "پرداخت" },
  "/checkout/success": { parentHref: "/", parentLabel: "خانه", currentLabel: "تأیید سفارش" },
  "/wishlist": { parentHref: "/", parentLabel: "خانه", currentLabel: "ذخیره‌ها" },
  "/collections": { parentHref: "/wishlist", parentLabel: "ذخیره‌ها", currentLabel: "کالکشن‌های من" },
  "/compare": { parentHref: "/products", parentLabel: "محصولات", currentLabel: "مقایسه" },
  "/second-hand": { parentHref: "/", parentLabel: "خانه", currentLabel: "دسته دوم" },
  "/magazine": { parentHref: "/", parentLabel: "خانه", currentLabel: "مجله" },
  "/projects": { parentHref: "/", parentLabel: "خانه", currentLabel: "پروژه‌ها" },
  "/ai": { parentHref: "/", parentLabel: "خانه", currentLabel: "AI استودیو" },
  "/ai/design": { parentHref: "/ai", parentLabel: "AI استودیو", currentLabel: "طراحی هوشمند" },
  "/ai/history": { parentHref: "/ai", parentLabel: "AI استودیو", currentLabel: "تاریخچه طراحی" },
  "/account": { parentHref: "/", parentLabel: "خانه", currentLabel: "حساب کاربری" },
  "/vendor": { parentHref: "/", parentLabel: "خانه", currentLabel: "پنل فروشنده" },
  "/admin": { parentHref: "/", parentLabel: "خانه", currentLabel: "پنل مدیریت" },
  "/login": { parentHref: "/", parentLabel: "خانه", currentLabel: "ورود" },
  "/register": { parentHref: "/", parentLabel: "خانه", currentLabel: "ثبت‌نام" },
  "/forgot-password": { parentHref: "/login", parentLabel: "ورود", currentLabel: "بازیابی رمز" },
};

const sections: { prefix: string; parentHref: string; parentLabel: string; currentLabel: string }[] = [
  { prefix: "/products/", parentHref: "/products", parentLabel: "محصولات", currentLabel: "جزئیات محصول" },
  { prefix: "/category/", parentHref: "/products", parentLabel: "محصولات", currentLabel: "دسته‌بندی" },
  { prefix: "/stores/", parentHref: "/stores", parentLabel: "فروشگاه‌ها", currentLabel: "فروشگاه" },
  { prefix: "/styles/", parentHref: "/styles", parentLabel: "سبک‌ها", currentLabel: "راهنمای سبک" },
  { prefix: "/inspiration/", parentHref: "/inspiration", parentLabel: "الهام", currentLabel: "جزئیات ایده" },
  { prefix: "/ai/result/", parentHref: "/ai/history", parentLabel: "تاریخچه طراحی", currentLabel: "نتیجه طراحی" },
  { prefix: "/magazine/", parentHref: "/magazine", parentLabel: "مجله", currentLabel: "مقاله" },
  { prefix: "/projects/", parentHref: "/projects", parentLabel: "پروژه‌ها", currentLabel: "جزئیات پروژه" },
  { prefix: "/account/", parentHref: "/account", parentLabel: "حساب کاربری", currentLabel: "بخش حساب" },
  { prefix: "/vendor/", parentHref: "/vendor", parentLabel: "پنل فروشنده", currentLabel: "بخش فروشنده" },
  { prefix: "/admin/", parentHref: "/admin", parentLabel: "پنل مدیریت", currentLabel: "بخش مدیریت" },
];

function resolveContext(pathname: string): RouteContext | null {
  if (pathname === "/") return null;
  if (exact[pathname]) return exact[pathname];
  const section = sections.find((item) => pathname.startsWith(item.prefix));
  if (section) return section;
  return { parentHref: "/", parentLabel: "خانه", currentLabel: "Homeino" };
}

export function ContextNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const context = resolveContext(pathname);
  if (!context) return null;

  const goBack = () => {
    // Use real browser history whenever it exists; direct entries fall back to the
    // route's semantic parent so the user never reaches a dead end.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(context.parentHref);
  };

  return (
    <div className="border-b border-clay/30 bg-cream/72">
      <Container>
        <div className="flex min-h-11 min-w-0 items-center justify-between gap-3 py-1.5">
          <button type="button" onClick={goBack} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-ink transition hover:bg-ivory-2" aria-label={`بازگشت به ${context.parentLabel}`}>
            <ArrowRight size={16} />
            <span>بازگشت</span>
          </button>
          <nav aria-label="مسیر صفحه" className="flex min-w-0 items-center gap-1 text-xs text-ink-muted">
            <Link href="/" className="hidden shrink-0 items-center gap-1 transition hover:text-ink sm:flex"><Home size={13} /> خانه</Link>
            <ChevronLeft size={13} className="hidden shrink-0 opacity-45 sm:block" />
            {context.parentHref !== "/" && <><Link href={context.parentHref} className="hidden shrink-0 transition hover:text-ink sm:block">{context.parentLabel}</Link><ChevronLeft size={13} className="hidden shrink-0 opacity-45 sm:block" /></>}
            <span className="truncate font-medium text-ink" aria-current="page">{context.currentLabel}</span>
          </nav>
        </div>
      </Container>
    </div>
  );
}
