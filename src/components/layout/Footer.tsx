"use client";
import { useState } from "react";
import Link from "next/link";
import { AtSign, Send, Globe, Gift, Check, Phone, Mail } from "lucide-react";
import { Container } from "../ui/primitives";
import { categories } from "@/data/categories";
import { subscribeNewsletter } from "@/lib/commerceClient";
import { useUi } from "@/stores/useApp";

const COLS = [
  { title: "کاوش", links: [["همه محصولات", "/products"], ["دسته دوم", "/second-hand"], ["الهام", "/inspiration"], ["پروژه‌ها", "/projects"], ["مجله", "/magazine"]] },
  { title: "پلتفرم", links: [["فروشگاه‌ها", "/stores"], ["مقایسه", "/compare"], ["علاقه‌مندی", "/wishlist"], ["دسته دوم", "/second-hand"]] },
  { title: "حساب کاربری", links: [["پروفایل", "/account/profile"], ["اعتبار هومینو استودیو", "/account/credits"], ["سفارش‌ها", "/account/orders"], ["آگهی‌های من", "/account/ads"], ["طراحی‌های من", "/account/designs"]] },
  { title: "پنل‌ها", links: [["پنل فروشنده", "/vendor"], ["پنل مدیریت", "/admin"], ["ثبت فروشگاه", "/register/vendor"], ["پیوستن به ما", "/register/vendor"]] },
  { title: "پشتیبانی", links: [["درباره هومینو", "/about"], ["تماس با ما", "/contact"], ["قوانین و مقررات", "/terms"], ["حریم خصوصی", "/privacy"], ["رویه بازگشت کالا", "/refund"]] },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [err, setErr] = useState("");
  const { toast } = useUi();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email && !phone) { setErr("ایمیل یا شماره موبایل را وارد کن"); return; }
    setBusy(true);
    const res = await subscribeNewsletter({ email: email || undefined, phone: phone || undefined, source: "footer" });
    setBusy(false);
    if (res.ok) {
      setDoneMsg(res.data.message ?? "عضویت ثبت شد");
    } else {
      setErr(res.message ?? "ثبت ناموفق بود — دوباره تلاش کن");
      toast(res.message ?? "ثبت ناموفق بود", "error");
    }
  };
  if (doneMsg) return <div className="flex items-center gap-1.5 rounded-lg bg-sage/20 px-3 py-2 text-xs font-bold text-sage-soft"><Check size={14} /> {doneMsg}</div>;
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" placeholder="ایمیلت..." className="w-full rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-xs text-cream outline-none focus:border-gold/50" />
        <button type="submit" disabled={busy} className="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-ink transition hover:opacity-90 disabled:opacity-50">{busy ? "..." : "دریافت هدیه"}</button>
      </div>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" placeholder="یا شماره موبایل 09xxxxxxxxx" className="w-full rounded-lg border border-white/15 bg-ink/40 px-3 py-2 text-xs text-cream outline-none focus:border-gold/50" />
      {err && <p className="text-2xs text-red-300">{err}</p>}
    </form>
  );
}

export function Footer() {
  const [socialNote, setSocialNote] = useState(false);
  return (
    <footer className="mt-24 border-t border-clay/40 bg-ink text-cream/80">
      <Container className="py-14">
        {/* CTA strip — marketplace focused, not AI */}
        <div className="mb-12 flex flex-col items-start justify-between gap-5 rounded-[var(--radius-xl)] bg-gradient-to-l from-terracotta to-terracotta-deep p-8 text-white md:flex-row md:items-center">
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
              هر چیزی که برای ساختن خانه‌ای که دوست داری لازم داری، در یک مکان. الهام، محصول، فروشگاه و طراحی با هومینو استودیو.
            </p>
            {socialNote && <p className="mt-2 text-xs text-gold-soft">شبکه‌های اجتماعی Homeino به‌زودی راه می‌افتند.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {([
                ["Instagram", process.env.NEXT_PUBLIC_INSTAGRAM_URL],
                ["Telegram", process.env.NEXT_PUBLIC_TELEGRAM_URL],
                ["WhatsApp", process.env.NEXT_PUBLIC_WHATSAPP_URL],
              ] as const).map(([label, url]) => (
                <a key={label} href={url || "#"} target={url ? "_blank" : undefined} rel="noopener noreferrer"
                  aria-label={label}
                  onClick={url ? undefined : (e) => { e.preventDefault(); setSocialNote(true); }}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20">
                  {label === "Instagram" ? <AtSign size={17} /> : label === "Telegram" ? <Send size={17} /> : <Globe size={17} />}
                </a>
              ))}
              {(process.env.NEXT_PUBLIC_SUPPORT_PHONE || process.env.NEXT_PUBLIC_SUPPORT_EMAIL) && (
                <div className="ms-2 flex flex-col justify-center text-2xs leading-4 text-cream/60">
                  {process.env.NEXT_PUBLIC_SUPPORT_PHONE && <span className="flex items-center gap-1" dir="ltr"><Phone size={11} /> {process.env.NEXT_PUBLIC_SUPPORT_PHONE}</span>}
                  {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && <span className="flex items-center gap-1" dir="ltr"><Mail size={11} /> {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}</span>}
                </div>
              )}
            </div>
            {/* Newsletter capture with incentive */}
            <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gold-soft"><Gift size={16} /> عضو خبرنامه شو، هدیه بگیر</div>
              <p className="mb-3 text-xs leading-5 text-cream/60">با عضویت، کد تخفیف ۱۰٪ و ۲۰ اعتبار هومینو استودیو رایگان بگیر.</p>
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
          <p>© {new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date())} Homeino — تمام حقوق محفوظ است.</p>
          <div className="flex flex-wrap items-center gap-4">
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="hover:text-cream">{c.name}</Link>
            ))}
            {/* e-Namad / ساماندهی slots — appear when the env vars are set */}
            {process.env.NEXT_PUBLIC_ENAMAD_URL && (
              <a href={process.env.NEXT_PUBLIC_ENAMAD_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/20 px-2 py-1 hover:text-cream">نماد اعتماد الکترونیکی</a>
            )}
            {process.env.NEXT_PUBLIC_SAMANDEHI_URL && (
              <a href={process.env.NEXT_PUBLIC_SAMANDEHI_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/20 px-2 py-1 hover:text-cream">نشان ملی ثبت</a>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
