"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Check, ArrowRight, ArrowLeft, FileText, User, BadgeCheck } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { submitVendorRegistration } from "@/data/vendorRegistrations";
import { toFa, cn } from "@/lib/utils";

const STEPS = ["اطلاعات فروشگاه", "مدیر فروشگاه", "بررسی نهایی"] as const;
const CATEGORIES = ["مبلمان و مبل", "روشنایی", "فرش و قالیچه", "منسوجات خانگی", "دکور و اکسسوری", "دکوراتیو و لوازم تزئینی"];
const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";
const field = "mb-1.5 block text-sm font-medium text-ink";

export default function VendorRegisterPage() {
  const { toast } = useUi();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ storeName: "", city: "", category: CATEGORIES[0], description: "", ownerName: "", phone: "" });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const canNext = step === 0 ? form.storeName.trim().length > 1 : step === 1 ? form.ownerName.trim().length > 1 && form.phone.trim().length > 8 : true;

  function submit() {
    if (busy) return;
    setBusy(true);
    submitVendorRegistration({
      storeName: form.storeName.trim(),
      ownerName: form.ownerName.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      category: form.category,
      description: form.description.trim(),
    });
    setTimeout(() => {
      toast("درخواست ثبت فروشگاه دریافت شد و برای بررسی در پنل مدیریت ثبت شد");
      router.push("/register/vendor/done");
    }, 700);
  }

  return (
    <Container className="py-12">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "ثبت فروشگاه" }]} />
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-4 flex items-center gap-2 font-display text-2xl font-black text-ink"><Store size={22} className="text-terracotta-deep" /> فروشگاهت را در Homeino باز کن</h1>
        <p className="mt-1 text-sm text-ink-muted">در این دمو، درخواست تو بدون دیتابیس ثبت می‌شود و در «مدیریت فروشندگان» ادمین دیده می‌شود.</p>

        {/* steps */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition", i <= step ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted")}>{i < step ? <Check size={15} /> : toFa(i + 1)}</span>
              <span className={cn("hidden text-sm sm:block", i <= step ? "font-bold text-ink" : "text-ink-muted")}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-clay/60" />}
            </div>
          ))}
        </div>

        <form
          className="card-surface mt-6 p-6"
          onSubmit={(e) => { e.preventDefault(); if (step < 2) setStep(step + 1); else submit(); }}
        >
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><FileText size={16} className="text-terracotta-deep" /> اطلاعات فروشگاه</div>
              <div><label className={field}>نام فروشگاه *</label><input value={form.storeName} onChange={(e) => set({ storeName: e.target.value })} placeholder="مثلاً مبل‌سازی آریا" className={input} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={field}>شهر</label><input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="مثلاً تهران" className={input} /></div>
                <div><label className={field}>حوزه اصلی</label><select value={form.category} onChange={(e) => set({ category: e.target.value })} className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div><label className={field}>معرفی فروشگاه</label><textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="چه چیزهایی می‌فروشی؟ سابقه و کارگاهت را بنویس…" className={`${input} resize-none`} /></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><User size={16} className="text-terracotta-deep" /> مدیر فروشگاه</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={field}>نام و نام خانوادگی *</label><input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="نام کامل مدیر" className={input} /></div>
                <div><label className={field}>شماره تماس *</label><input dir="ltr" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="09xxxxxxxxx" className={`${input} text-right`} /></div>
              </div>
              <p className="text-xs leading-6 text-ink-muted">کارشناسان Homeino برای تأیید هویت و بازدید از کارگاه با این شماره تماس می‌گیرند.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><BadgeCheck size={16} className="text-terracotta-deep" /> بررسی نهایی درخواست</div>
              <div className="space-y-2 rounded-xl border border-clay/40 bg-ivory-2 p-4 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">فروشگاه</span><b className="text-ink">{form.storeName || "—"}</b></div>
                <div className="flex justify-between"><span className="text-ink-muted">شهر / حوزه</span><b className="text-ink">{form.city || "—"} · {form.category}</b></div>
                <div className="flex justify-between"><span className="text-ink-muted">مدیر</span><b className="text-ink">{form.ownerName || "—"} · {form.phone}</b></div>
              </div>
              <p className="text-xs leading-6 text-ink-muted">با ثبت درخواست، وضعیت «در انتظار بررسی» برای این فروشگاه در پنل مدیریت ثبت می‌شود و پس از تأیید، پنل فروشنده فعال می‌شود.</p>
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            {step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}><ArrowRight size={15} /> مرحله قبل</Button> : <span />}
            <Button type="submit" disabled={!canNext || busy}>
              {step < 2 ? <>مرحله بعد <ArrowLeft size={15} /></> : busy ? "در حال ثبت…" : "ثبت درخواست فروشگاه"}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">هم‌اکنون پنل فروشندهٔ نمونه را ببین: <Link href="/vendor" className="text-terracotta-deep underline">داشبورد فروشنده</Link></p>
      </div>
    </Container>
  );
}
