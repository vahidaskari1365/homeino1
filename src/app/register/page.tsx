"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Phone, MapPin, Store, Factory, Check, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Spinner } from "@/components/ui/primitives";
import { useAuth, useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useUi();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [phone, setPhone] = useState("");
  const [isProducer, setIsProducer] = useState(false);
  const [brand, setBrand] = useState("");
  const [contactName, setContactName] = useState("");
  const [producerPhone, setProducerPhone] = useState("");
  const [city, setCity] = useState("");
  const [catSlugs, setCatSlugs] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const toggleCat = (slug: string) => setCatSlugs((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 3) return setErr("نام و نام خانوادگی را کامل وارد کن");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setErr("ایمیل معتبر نیست");
    if (pwd.length < 6) return setErr("رمز حداقل ۶ کاراکتر است");
    if (!agree) return setErr("پذیرش قوانین الزامی است");
    if (isProducer) {
      if (brand.trim().length < 2) return setErr("نام برند / فروشگاه الزامی است");
      if (catSlugs.length === 0) return setErr("حداقل یک دسته‌ی فعالیت انتخاب کن");
    }
    setLoading(true);
    setTimeout(() => {
      login(email, isProducer ? { name: brand, role: "vendor", brand } : { name });
      toast(isProducer ? "ثبت‌نام تولیدکننده با موفقیت انجام شد" : "ثبت‌نام با موفقیت انجام شد");
      router.push(isProducer ? "/vendor" : "/account");
    }, 900);
  };

  return (
    <AuthShell title="ساخت حساب جدید" subtitle="به خانواده‌ی Homeino بپیوند. رایگان و سریع." footer={<>حساب داری؟ <Link href="/login" className="font-medium text-terracotta-deep">وارد شو</Link></>}>
      {/* Google (placeholder) */}
      <button type="button" onClick={() => toast("ورود با گوگل به‌زودی فعال می‌شود", "info")} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-clay/60 bg-cream py-3 text-sm font-medium text-ink transition hover:bg-ivory-2">
        <img src="https://www.google.com/favicon.ico" alt="" className="h-5 w-5" /> ورود با حساب گوگل
      </button>
      <div className="relative mb-5 text-center text-xs text-ink-muted"><span className="relative z-10 bg-cream px-2">یا با ایمیل</span><span className="absolute inset-x-0 top-1/2 h-px bg-clay/50" /></div>

      <form onSubmit={submit} className="space-y-4">
        <Labeled icon={User} label="نام و نام خانوادگی" value={name} onChange={setName} />
        <Labeled icon={Mail} label="ایمیل" type="email" value={email} onChange={setEmail} />
        <Labeled icon={Lock} label="رمز عبور" type="password" value={pwd} onChange={setPwd} hint="حداقل ۶ کاراکتر" />

        {/* Producer toggle */}
        <button type="button" onClick={() => setIsProducer(!isProducer)} className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-right transition", isProducer ? "border-gold/40 bg-gold/5" : "border-clay/60 bg-cream hover:border-clay")}>
          <span className={cn("mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border transition", isProducer ? "border-gold bg-gold text-ink" : "border-clay")}>{isProducer && <Check size={13} />}</span>
          <div className="flex-1">
            <span className="flex items-center gap-2 font-medium text-ink"><Factory size={16} className="text-gold" /> به‌عنوان تولیدکننده / فروشنده ثبت‌نام می‌کنم</span>
            <p className="mt-1 text-xs text-ink-muted">اگر فروشگاه یا تولیدی داری، اطلاعات برندت را وارد کن تا پنل فروشنده برایت فعال شود.</p>
          </div>
        </button>

        {/* Producer fields */}
        {isProducer && (
          <div className="space-y-4 rounded-xl border border-gold/25 bg-gold/5 p-4">
            <Labeled icon={Store} label="نام برند / فروشگاه" value={brand} onChange={setBrand} placeholder="مثلاً: مبلمان رویال" required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Labeled icon={User} label="نام مسئول" value={contactName} onChange={setContactName} />
              <Labeled icon={Phone} label="شماره تماس" type="tel" value={producerPhone} onChange={setProducerPhone} />
            </div>
            <Labeled icon={MapPin} label="شهر" value={city} onChange={setCity} placeholder="مثلاً: تهران" />

            <div>
              <div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-ink">دسته‌ی فعالیت <span className="text-danger">*</span></label><span className="text-xs text-ink-muted">{catSlugs.length ? `${catSlugs.length} دسته انتخاب شده` : "حداقل یک مورد"}</span></div>
              <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-clay/50 bg-cream p-2">
                {categories.map((c) => { const checked = catSlugs.includes(c.slug); return (
                  <button type="button" key={c.id} onClick={() => toggleCat(c.slug)} className={cn("flex items-center gap-2 rounded-lg border p-2 text-right text-sm transition", checked ? "border-gold/50 bg-gold/15 text-ink" : "border-transparent text-ink-muted hover:bg-ivory-2")}>
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", checked ? "border-gold bg-gold text-ink" : "border-clay")}>{checked && <Check size={11} />}</span>
                    {c.name}
                  </button>
                ); })}
              </div>
            </div>
          </div>
        )}

        <label className="flex items-start gap-2 text-xs text-ink-muted">
          <button type="button" onClick={() => setAgree(!agree)} className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border", agree ? "border-terracotta bg-terracotta text-white" : "border-clay")}>{agree && <Check size={11} />}</button>
          <span>قوانین و مقررات Homeino را می‌پذیرم.</span>
        </label>

        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <><Spinner /> در حال ثبت…</> : <>{isProducer ? <><Store size={16} /> ثبت‌نام تولیدکننده</> : "ثبت‌نام"}</>}</Button>
        {isProducer && <p className="flex items-center justify-center gap-1 text-center text-xs text-gold"><Sparkles size={12} /> بعد از ثبت‌نام، مستقیم وارد پنل فروشنده می‌شوی</p>}
      </form>
    </AuthShell>
  );
}

function Labeled({ icon: Icon, label, type = "text", value, onChange, placeholder, hint, required }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink">{label}{required && <span className="text-danger">*</span>}</label>
      <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
        <Icon size={17} className="text-ink-muted" />
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
        {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
      </div>
    </div>
  );
}
