"use client";
import { useState } from "react";
import Link from "next/link";
import { AtSign, Send, Globe, Gift, Check } from "lucide-react";
import { Container } from "../ui/primitives";
import { categories } from "@/data/categories";

const COLS = [
  { title: "کاوش", links: [["همه محصولات", "/products"], ["دسته دوم", "/second-hand"], ["الهام", "/inspiration"], ["پروژه‌ها", "/projects"], ["مجله", "/magazine"]] },
  { title: "پلتفرم", links: [["فروشگاه‌ها", "/stores"], ["مقایسه", "/compare"], ["علاقه‌مندی", "/wishlist"], ["کالکشن‌های من", "/collections"]] },
  { title: "حساب کاربری", links: [["پروفایل", "/account"], ["اعتبار AI", "/account/credits"], ["سفارش‌ها", "/account/orders"], ["طراحی‌های من", "/account/designs"]] },
  { title: "پنل‌ها", links: [["پنل فروشنده", "/vendor"], ["پنل مدیریت", "/admin"], ["ثبت فروشگاه", "/vendor"], ["پیوستن به ما", "/vendor"]] },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return;
    setDone(true);
  };
  if (done) return <div className="flex items-center gap-1.5 rounded-lg bg-sage/20 px-3 py-2 text-xs font-bold text-sage-soft"><Check size={14} /> ایمیل در نسخه نمایشی ثبت شد.</div>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 min-[400px]:flex-row">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" placeholder="ایمیلت..." className="min-w-0 flex-1 rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-xs text-cream outline-none focus:border-gold/50" />
      <button type="submit" className="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-ink transition hover:opacity-90">عضویت</button>
    </form>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-clay/40 bg-ink text-cream/80">
      <Container className="pb-28 pt-12 lg:py-14">
        {/* CTA strip — marketplace focused, not AI */}
        <div className="mb-12 flex flex-col items-start justify-between gap-5 rounded-[var(--radius-xl)] bg-gradient-to-l from-terracotta to-terracotta-deep p-5 text-white sm:p-8 md:flex-row md:items-center">
          <div>
            <h3 className="font-display text-2xl font-bold text-white">همه‌چیز برای خانه‌ای که دوست داری</h3>
            <p className="mt-1 text-sm text-white/80">از مبلمان و دکوراسیون تا الهام و طراحی — همه در یک مکان.</p>
          </div>
          <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-cream px-6 py-3 font-medium text-ink transition hover:bg-ivory-2">
            شروع خرید
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream text-ink"><span className="font-display text-lg font-black">H</span></span>
              <span className="font-display text-xl font-black text-cream">Home<span className="text-terracotta-soft">ino</span></span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-cream/60">
              هر چیزی که برای ساختن خانه‌ای که دوست داری لازم داری، در یک مکان. الهام، محصول، فروشگاه و طراحی با هوش مصنوعی.
            </p>
            <div className="mt-4 flex gap-2">
              {[AtSign, Send, Globe].map((Icon, i) => (
                <span key={i} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"><Icon size={17} /></span>
              ))}
            </div>
            {/* Newsletter capture with incentive */}
            <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-soft"><Gift size={16} /> ایده‌ها و تازه‌های خانه</div>
              <p className="mb-3 text-xs leading-5 text-cream/60">محصولات تازه، راهنمای انتخاب و کالکشن‌های منتخب را دریافت کن؛ بدون وعده یا تخفیف ساختگی.</p>
              <NewsletterForm />
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-sm font-bold text-cream">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label + href}><Link href={href} className="text-sm text-cream/60 transition hover:text-cream link-underline">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cream/50 md:flex-row">
          <p>© ۱۴۰۵ Homeino — تمام حقوق محفوظ است.</p>
          <div className="flex flex-wrap gap-4">
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="hover:text-cream">{c.name}</Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
