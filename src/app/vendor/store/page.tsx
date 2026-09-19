"use client";
import { useEffect, useState } from "react";
import { Button, LogoBlock, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { SmartImage } from "@/components/ui/SmartImage";
import { vendorStoreProfile, updateVendorStoreProfile } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { cn } from "@/lib/utils";
import { ExternalLink, LogIn, Info, Save } from "lucide-react";
import {
  fetchVendorMeCached,
  updateVendorSettings,
  invalidateVendorMeCache,
  isDemoFallback,
  isValidShaba,
  isValidCardNumber,
  normalizeShaba,
  normalizeCardNumber,
  type VendorMe,
} from "@/lib/vendorClient";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";
const LOGO_COLORS = ["#c2703f", "#6b7f5e", "#3f5f6b", "#8a5a44", "#4a4a4a"];

type Mode =
  | { kind: "loading" }
  | { kind: "real"; me: VendorMe }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function VendorStorePage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  // Real backend first — the demo profile editor below is ONLY a fallback for
  // DB-less deployments (503 DEMO_MODE) or a dead network (status 0).
  useEffect(() => {
    let alive = true;
    void fetchVendorMeCached().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real", me: res.data });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت تنظیمات فروشگاه…</div>;
  }
  if (mode.kind === "demo") return <DemoStorePage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">تنظیمات واقعی فروشگاه فقط با ورود به حساب کاربری قابل ویرایش است.</p>
        <a href="/login?next=%2Fvendor%2Fstore" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت تنظیمات</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealStorePage me={mode.me} />;
}

/* ============================================================
   REAL STORE SETTINGS — PATCH /api/vendor/settings
   (توضیحات، شهر، تماس، سیاست‌ها + راه‌های واریز: شبا/کارت/نام صاحب حساب)
   ============================================================ */

function RealStorePage({ me }: { me: VendorMe }) {
  const { toast } = useUi();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const vendor = me.vendor;
  const payout = me.payoutSettings;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const shabaRaw = String(fd.get("shaba") ?? "").trim();
    const cardRaw = String(fd.get("cardNumber") ?? "").trim();

    if (shabaRaw && !isValidShaba(shabaRaw)) {
      setFormError("شِبا معتبر نیست — باید با IR شروع شود و دقیقاً ۲۴ رقم بعد از آن باشد (مجموعاً ۲۶ کاراکتر).");
      return;
    }
    if (cardRaw && !isValidCardNumber(cardRaw)) {
      setFormError("شماره کارت معتبر نیست — باید دقیقاً ۱۶ رقم باشد.");
      return;
    }
    const email = String(fd.get("contactEmail") ?? "").trim();
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setFormError("ایمیل تماس معتبر نیست.");
      return;
    }

    setSaving(true);
    void updateVendorSettings({
      description: String(fd.get("description") ?? ""),
      city: String(fd.get("city") ?? "").trim(),
      contactEmail: email,
      contactPhone: String(fd.get("contactPhone") ?? "").trim(),
      accountHolderName: String(fd.get("accountHolderName") ?? "").trim(),
      cardNumber: cardRaw ? normalizeCardNumber(cardRaw) : "",
      shaba: shabaRaw ? normalizeShaba(shabaRaw) : "",
      // سمت سرور مقدارِ «undefined» را نادیده می‌گیرد؛ چون مقدار فعلی این دو
      // فیلد از /vendor/me برنمی‌گردد، خالی‌شان را ارسال نمی‌کنیم تا پاک نشوند.
      ...(String(fd.get("shippingPolicy") ?? "").trim() ? { shippingPolicy: String(fd.get("shippingPolicy") ?? "") } : {}),
      ...(String(fd.get("returnPolicy") ?? "").trim() ? { returnPolicy: String(fd.get("returnPolicy") ?? "") } : {}),
    }).then((res) => {
      setSaving(false);
      if (res.ok) {
        invalidateVendorMeCache();
        toast("ذخیره شد — تنظیمات واقعی فروشگاه روی سرور بروزرسانی شد", "success");
      } else {
        setFormError(res.message ?? "ذخیرهٔ تنظیمات ناموفق بود");
        toast(res.message ?? "ذخیرهٔ تنظیمات ناموفق بود", "error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">تنظیمات فروشگاه</h1>
        <a href={`/stores/${vendor.slug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink size={14} /> مشاهده فروشگاه در سایت</Button></a>
      </div>
      <form onSubmit={submit} className="card-surface grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 border-b border-clay/40 pb-4">
          <LogoBlock char={vendor.name[0] ?? "ف"} color="#c2703f" size={48} />
          <div>
            <div className="font-display font-black text-ink">{vendor.name}</div>
            <div className="text-xs text-ink-muted">شناسه عمومی فروشگاه: <span dir="ltr">{vendor.slug}</span></div>
          </div>
        </div>
        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات فروشگاه</label><textarea name="description" rows={3} defaultValue={vendor.description ?? ""} className={`${input} resize-none`} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">شهر</label><input name="city" defaultValue={vendor.city ?? ""} className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">شماره تماس</label><input name="contactPhone" defaultValue={vendor.contactPhone ?? ""} className={input} dir="ltr" /></div>
        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">ایمیل تماس</label><input name="contactEmail" defaultValue={vendor.contactEmail ?? ""} className={input} dir="ltr" /></div>
        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست ارسال <span className="text-2xs font-normal text-ink-muted">(مقدار فعلی از سرور نمایش داده نمی‌شود — اگر خالی بماند، مقدار قبلی دست‌نخورده می‌ماند)</span></label><textarea name="shippingPolicy" rows={2} className={`${input} resize-none`} /></div>
        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست بازگشت <span className="text-2xs font-normal text-ink-muted">(اگر خالی بماند، مقدار قبلی دست‌نخورده می‌ماند)</span></label><textarea name="returnPolicy" rows={2} className={`${input} resize-none`} /></div>

        <div className="sm:col-span-2 border-t border-clay/40 pt-4">
          <h2 className="mb-1 font-display font-bold text-ink">راه‌های واریز تسویه</h2>
          <p className="mb-3 text-xs leading-6 text-ink-muted">
            این اطلاعات فقط برای واریز تسویه‌های فروش توسط مدیر هومینو استفاده می‌شود. شِبا با «IR» و ۲۴ رقم؛ شماره کارت با ۱۶ رقم.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-sm font-medium text-ink">نام صاحب حساب</label><input name="accountHolderName" defaultValue={payout?.accountHolderName ?? ""} className={input} /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">شماره کارت (۱۶ رقم)</label><input name="cardNumber" inputMode="numeric" defaultValue={payout?.cardNumber ?? ""} className={input} dir="ltr" placeholder="6104XXXXXXXXXXXX" /></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">شِبا (IR + ۲۴ رقم)</label><input name="shaba" defaultValue={payout?.shaba ?? ""} className={input} dir="ltr" placeholder="IR__________________________" /></div>
          </div>
          {payout?.payoutsEnabled === false && (
            <p className="mt-3 rounded-xl border border-gold/30 bg-gold/8 px-3 py-2 text-2xs leading-6 text-ink">تسویه برای فروشگاه شما هنوز توسط مدیر فعال نشده است — اطلاعات را ثبت کنید تا پس از فعال‌سازی استفاده شود.</p>
          )}
        </div>

        {formError && <p role="alert" className="sm:col-span-2 text-sm text-danger">{formError}</p>}
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? <><Spinner /> در حال ذخیره…</> : <><Save size={15} /> ذخیره</>}</Button>
          <span className="text-2xs text-ink-muted">تغییرات مستقیم روی سرور هومینو ذخیره می‌شود.</span>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   DEMO STORE SETTINGS — fallback صادقانه (۵۰۳ DEMO_MODE / قطعی شبکه).
   رفتار قبلی با vendorSession دست‌نخورده حفظ شده است.
   ============================================================ */

function DemoStorePage() {
  const { toast } = useUi();
  const vsVersion = useVendorSessionVersion();
  const [profile, setProfile] = useState(vendorStoreProfile());
  const [logoColor, setLogoColor] = useState(profile.logoColor);
  const [syncedVersion, setSyncedVersion] = useState(vsVersion);
  // Render-phase sync (the React-documented alternative to setState-in-effect):
  // when the persisted session lands post-hydration — or after a save — the
  // local form mirror re-reads it. Uncontrolled inputs keep typing untouched.
  if (syncedVersion !== vsVersion) {
    setSyncedVersion(vsVersion);
    const next = vendorStoreProfile();
    setProfile(next);
    setLogoColor(next.logoColor);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">تنظیمات فروشگاه</h1>
        <a href="/stores/noor-mobl" target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink size={14} /> مشاهده فروشگاه در سایت</Button></a>
      </div>
      <div className="card-surface p-6">
        <div className="mb-5"><SmartImage src={profile.cover} alt="کاور" className="aspect-[4/1] w-full rounded-xl" /></div>
        <div className="-mt-10 mb-5 flex items-end gap-4">
          <div className="card-surface p-2"><LogoBlock char={profile.logoChar} color={profile.logoColor} size={64} /></div>
          <span className="mb-2 text-xs text-ink-muted">{profile.city} · پاسخ‌گویی {profile.responseTime}</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const next = updateVendorStoreProfile({
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? ""),
          city: String(fd.get("city") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          logoChar: String(fd.get("logoChar") ?? ""),
          logoColor,
          cover: String(fd.get("cover") ?? ""),
          shippingPolicy: String(fd.get("shippingPolicy") ?? ""),
          returnPolicy: String(fd.get("returnPolicy") ?? ""),
        }); setProfile(next); setLogoColor(next.logoColor); toast("ذخیره شد — همان لحظه در صفحهٔ عمومی فروشگاه هم اعمال می‌شود"); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">نام فروشگاه</label><input name="name" defaultValue={profile.name} className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea name="description" rows={2} defaultValue={profile.description} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
            <div className="min-w-40 flex-1"><label className="mb-1.5 block text-sm font-medium text-ink">کاراکتر لوگو</label><input name="logoChar" defaultValue={profile.logoChar} maxLength={1} className={input} dir="rtl" /></div>
            <div className="min-w-40 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-ink">رنگ لوگو</label>
              <div className="flex gap-2 pt-1">
                {LOGO_COLORS.map((color) => (
                  <button type="button" key={color} aria-label={`رنگ ${color}`} onClick={() => setLogoColor(color)} className={cn("h-8 w-8 rounded-full border-2 transition", logoColor === color ? "border-ink" : "border-transparent hover:border-clay")} style={{ background: color }} />
                ))}
              </div>
            </div>
          </div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">کاور فروشگاه (آدرس تصویر — خالی بگذاری، تصویر فعلی می‌ماند)</label><input name="cover" defaultValue={profile.cover} className={input} dir="ltr" /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شهر</label><input name="city" defaultValue={profile.city} className={input} /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شماره تماس</label><input name="phone" defaultValue={profile.phone} className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست ارسال</label><textarea name="shippingPolicy" rows={2} defaultValue={profile.shippingPolicy} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست بازگشت</label><textarea name="returnPolicy" rows={2} defaultValue={profile.returnPolicy} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2"><Button type="submit">ذخیره</Button></div>
        </form>
      </div>
    </div>
  );
}
