"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, GitCompare, Search, ShieldCheck, Store, Wand2 } from "lucide-react";
import { Badge, ButtonLink, Container } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { useUi } from "@/stores/useApp";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { categories } from "@/data/categories";
import { IMG } from "@/data/media";
import { toFa } from "@/lib/utils";

export function Hero() {
  const setSearch = useUi((state) => state.setSearch);
  const verifiedStores = stores.filter((store) => store.verified).length;

  return (
    <section className="relative overflow-hidden bg-ink text-cream" aria-labelledby="homeino-hero-title">
      <div className="absolute inset-0 lg:right-[52%]">
        <SmartImage src={IMG.living5} alt="چیدمان گرم و مدرن فضای نشیمن" className="h-full w-full" loading="eager" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/38 to-ink/5 lg:bg-gradient-to-r lg:from-ink/15 lg:to-ink" />
      </div>
      <div className="grain pointer-events-none absolute inset-0 opacity-25" />

      <Container className="relative grid min-h-[680px] items-center py-16 sm:min-h-[720px] lg:grid-cols-[1.08fr_.92fr] lg:py-20">
        <div className="max-w-2xl lg:col-start-1">
          <Badge tone="dark" className="border-gold/30 bg-white/8 px-3 py-1.5 text-gold-soft backdrop-blur">
            <Store size={13} /> پلتفرم جامع خانه و بازارگاه چندفروشگاهی
          </Badge>
          <h1 id="homeino-hero-title" className="mt-5 text-balance text-[clamp(2.35rem,7vw,4.6rem)] font-black leading-[1.17] text-cream">
            از ایده تا خرید،<br /><span className="text-gold-gradient">همه‌چیز برای خانه.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-8 text-cream/74 sm:text-lg sm:leading-9">
            محصول و فروشگاه مناسب را پیدا کن، قیمت و شرایط را مقایسه کن، از فضاهای واقعی الهام بگیر و با اطمینان خرید کن.
          </p>

          <button type="button" onClick={() => setSearch(true)} className="mt-7 flex min-h-16 w-full max-w-xl items-center gap-3 rounded-2xl border border-white/15 bg-cream px-4 text-right text-ink shadow-[var(--shadow-lift)] transition hover:bg-white sm:px-5" aria-label="جستجو در محصولات، دسته‌بندی‌ها و فروشگاه‌ها">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terracotta text-white"><Search size={19} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black sm:text-base">میان انتخاب‌ها سریع‌تر پیدا کن</span><span className="mt-0.5 block truncate text-xs text-ink-muted">مثلاً مبل کرم برای پذیرایی کوچک…</span></span>
            <ArrowLeft size={19} className="shrink-0 text-terracotta" />
          </button>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/products" variant="gold" size="lg"><Search size={17} /> کاوش محصولات</ButtonLink>
            <ButtonLink href="/inspiration" variant="ghost" size="lg" className="border-white/25 text-cream hover:bg-white/10 hover:text-cream">الهام از فضاها</ButtonLink>
          </div>

          <div className="mt-7 grid max-w-xl grid-cols-3 gap-2 border-t border-white/12 pt-5 text-[11px] text-cream/65 sm:text-xs">
            <span><b className="block text-base text-cream">{toFa(products.length)}</b> محصول قابل کشف</span>
            <span><b className="block text-base text-cream">{toFa(verifiedStores)}</b> فروشگاه تأییدشده</span>
            <span><b className="block text-base text-cream">{toFa(categories.length)}</b> دسته‌بندی خانه</span>
          </div>
        </div>

        <div className="mt-9 self-end lg:absolute lg:bottom-10 lg:left-12 lg:mt-0 lg:w-[min(38vw,470px)]">
          <div className="grid gap-2 rounded-2xl border border-white/14 bg-ink/62 p-3 backdrop-blur-xl sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <span className="flex items-center gap-2 text-xs text-cream/75"><BadgeCheck size={16} className="shrink-0 text-sage-soft" /> هویت فروشگاه روشن</span>
            <span className="flex items-center gap-2 text-xs text-cream/75"><GitCompare size={16} className="shrink-0 text-sage-soft" /> مقایسه بدون ابهام</span>
            <span className="flex items-center gap-2 text-xs text-cream/75"><ShieldCheck size={16} className="shrink-0 text-sage-soft" /> خرید امن و قابل پیگیری</span>
          </div>
          <Link href="/ai/design" className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-3.5 text-cream backdrop-blur-xl transition hover:bg-gold/15">
            <span className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-ink"><Wand2 size={17} /></span><span><span className="block text-xs font-black">طراحی اختیاری با Homeino AI</span><span className="text-[10px] text-cream/58">پیش‌نمایش فضای تو، یکی از قابلیت‌های پلتفرم</span></span></span><ArrowLeft size={16} />
          </Link>
        </div>
      </Container>
    </section>
  );
}
