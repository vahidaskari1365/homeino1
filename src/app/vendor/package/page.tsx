"use client";
// ============================================================
// پکیج فروشنده — /vendor/package (Task 58)
//
// تنها جای خرید پکیج در کل سایت = بخش فروشنده (پنل /vendor).
// قیمت ماهانه ۲٬۲۸۰٬۰۰۰ تومان از PLATFORM (سرور، نه کلاینت).
// مزیت واقعی و خودکار: کارمزد فروش ۵٪ به‌جای ۹٪ پلتفرم — نرخ مؤثر
// هنگام ثبت هر ردیف صورت‌حساب snapshot می‌شود؛ انقضا خودکار است.
//
// الگوی صداقت ریپو: API واقعی اول؛ سقوط به دمو فقط روی 503+DEMO_MODE
// یا قطع شبکه؛ خطای واقعی = پیام صادقانه (هرگز پکیج فیک فعال نمی‌شود).
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Badge, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { PLATFORM } from "@/config/platform";
import { toFa, cn, formatCompactFa } from "@/lib/utils";
import {
  fetchVendorMeCached,
  invalidateVendorMeCache,
  isDemoFallback,
  purchaseVendorPackage,
  confirmVendorPackage,
  toman,
  faDate,
  type VendorMe,
} from "@/lib/vendorClient";
import { BadgeCheck, Crown, LogIn, Info, Percent, ShieldCheck, TrendingUp, Wallet, Landmark, RefreshCw } from "lucide-react";

type Mode =
  | { kind: "loading" }
  | { kind: "real"; me: VendorMe }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function VendorPackagePage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

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
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال بررسی وضعیت پکیج…</div>;
  }
  if (mode.kind === "demo") return <DemoPackagePage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">خرید پکیج فروشنده فقط با حساب کاربریِ متصل به فروشگاه شما ممکن است.</p>
        <a href="/login?next=%2Fvendor%2Fpackage" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت وضعیت پکیج</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealPackagePage me={mode.me} />;
}

/* ============================================================
   perks مشترک — همه واقعی و خودکار پس از فعال‌سازی
   ============================================================ */

const BREAK_EVEN_TOMAN = Math.round(
  PLATFORM.vendor.proPackage.priceToman /
    ((PLATFORM.vendor.commissionRatePercent - PLATFORM.vendor.proPackage.commissionRatePercent) / 100),
);

function perkRows() {
  const base = PLATFORM.vendor.commissionRatePercent;
  const pro = PLATFORM.vendor.proPackage.commissionRatePercent;
  const save = base - pro;
  return [
    {
      icon: Percent,
      title: `کارمزد فروش ${toFa(pro)}٪ به‌جای ${toFa(base)}٪`,
      desc: `روی هر فروش ${toFa(save)}٪ کمتر کمیسیون می‌دهید — نرخ مؤثر به‌صورت خودکار روی صورت‌حساب اعمال می‌شود.`,
    },
    {
      icon: TrendingUp,
      title: `نقطهٔ سربه‌سر: فروش ماهانهٔ ${formatCompactFa(BREAK_EVEN_TOMAN)} تومان`,
      desc: `اگر فروش ماهانه‌ات از این عدد بیشتر باشد، پکیج خودش را از محل کاهش کارمزد پس می‌دهد — بدون هیچ هزینهٔ پنهان.`,
    },
    {
      icon: BadgeCheck,
      title: "نشان «پلاس» در پنل فروشنده",
      desc: "وضعیت اشتراک فعال با تاریخ انقضای دقیق در داشبورد و صفحهٔ پکیج نمایش داده می‌شود.",
    },
    {
      icon: ShieldCheck,
      title: "شفافیت کامل در صورت‌حساب",
      desc: `نرخ کمیسیون هر ردیف فروش جداگانه ثبت و snapshot می‌شود؛ همیشه می‌بینی هر سطر با چه نرخی محاسبه شده است.`,
    },
  ];
}

function PackagePriceCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border-2 border-ink bg-gradient-to-bl from-ink to-ink-soft p-7 text-cream", className)}>
      <div className="absolute inset-0 grain opacity-30" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-gold" />
          <span className="font-display text-lg font-black">پکیج فروشنده پلاس</span>
        </div>
        <div className="mt-3 font-display text-4xl font-black">{formatCompactFa(PLATFORM.vendor.proPackage.priceToman)} <span className="text-base font-normal">تومان / ماه</span></div>
        <div className="mt-2 flex flex-wrap gap-2 text-2xs">
          <span className="rounded-full bg-white/10 px-3 py-1">کارمزد {toFa(PLATFORM.vendor.proPackage.commissionRatePercent)}٪ به‌جای {toFa(PLATFORM.vendor.commissionRatePercent)}٪</span>
          <span className="rounded-full bg-white/10 px-3 py-1">اعتبار {toFa(PLATFORM.vendor.proPackage.durationDays)} روز</span>
          <span className="rounded-full bg-white/10 px-3 py-1">تمدید از انتهای دورهٔ فعلی</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function RealPackagePage({ me }: { me: VendorMe }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(me.package);
  const effective = me.vendor.effectiveCommissionPercent;

  const refresh = useCallback(async () => {
    invalidateVendorMeCache();
    const res = await fetchVendorMeCached(true);
    if (res.ok) setState(res.data.package);
  }, []);

  // بازگشت از درگاه بانکی (کال‌بک زرین‌پال) → ?payment=success
  // الگوی لینت ریپو: setState فقط داخل کال‌بک غیرهمگام (then).
  const paymentReturnHandled = useRef(false);
  useEffect(() => {
    if (paymentReturnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    paymentReturnHandled.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    let alive = true;
    invalidateVendorMeCache();
    void fetchVendorMeCached(true).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setState(res.data.package);
        toast("پکیج فعال است — کارمزد فروش شما ۵٪ است", "success");
      } else {
        toast("پرداخت ثبت شد؛ وضعیت پکیج را بعد از رفرش صفحه ببین", "info");
      }
    });
    return () => { alive = false; };
  }, [toast]);

  async function buy() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await purchaseVendorPackage();
      if (!res.ok) {
        // خطای واقعی = پیام صادقانه؛ هیچ فعال‌سازی فکی وجود ندارد.
        toast(res.message ?? "خرید پکیج ممکن نشد", "error");
        return;
      }
      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl; // درگاه واقعی (زرین‌پال)
        return;
      }
      if (res.data.confirmable) {
        const confirmed = await confirmVendorPackage(res.data.paymentId);
        if (confirmed.ok) {
          toast(
            confirmed.data.duplicate
              ? "این پرداخت قبلاً فعال شده بود"
              : "پکیج فعال شد — کارمزد فروش شما ۵٪ است",
            "success",
          );
          await refresh();
          return;
        }
        toast(confirmed.message ?? "تأیید پرداخت ناموفق بود", "error");
        return;
      }
      toast("پرداخت واقعی فعال است — از درگاه بانکی ادامه بده", "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* وضعیت فعلی */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h1 className="font-display text-xl font-black text-ink">پکیج فروشنده</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {state.active
              ? `اشتراک پلاس فعال است تا ${faDate(state.expiresAt)} — کارمزد فروش شما همین حالا ${toFa(effective)}٪ است.`
              : `کارمزد فروش فعلی شما ${toFa(effective)}٪ است — با پکیج، به ${toFa(PLATFORM.vendor.proPackage.commissionRatePercent)}٪ کاهش می‌یابد.`}
          </p>
        </div>
        {state.active ? (
          <Badge tone="success"><BadgeCheck size={13} className="ml-1 inline" /> پلاس — کارمزد {toFa(effective)}٪</Badge>
        ) : (
          <Badge tone="neutral">بدون اشتراک فعال</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* مزیت‌ها — همه واقعی */}
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">با پکیج چه می‌شود؟</h3>
          <div className="space-y-3">
            {perkRows().map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl border border-clay/40 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/12 text-gold"><p.icon size={17} /></span>
                <div>
                  <div className="text-sm font-bold text-ink">{p.title}</div>
                  <p className="mt-1 text-xs leading-6 text-ink-muted">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-ivory-2 p-3 text-2xs leading-6 text-ink-muted">
            محاسبهٔ سربه‌سر: {toman(PLATFORM.vendor.proPackage.priceToman)} ÷ {toFa(PLATFORM.vendor.commissionRatePercent - PLATFORM.vendor.proPackage.commissionRatePercent)}٪ = فروش ماهانهٔ {formatCompactFa(BREAK_EVEN_TOMAN)} تومان. مثلاً با فروش ماهانهٔ ۱۰۰ میلیون تومان، اختلاف کارمزد {formatCompactFa(100_000_000 * (PLATFORM.vendor.commissionRatePercent - PLATFORM.vendor.proPackage.commissionRatePercent) / 100)} تومان در ماه صرفه‌جویی می‌شود.
          </p>
        </div>

        {/* کارت قیمت + گزینه‌های پرداخت */}
        <div className="space-y-4">
          <PackagePriceCard>
            {state.active && state.expiresAt && (
              <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs leading-6">اشتراک فعلی تا {faDate(state.expiresAt)} فعال است؛ خرید امروز پنجرهٔ جدیدی از انتهای همین دوره آغاز می‌کند — روزِ خریده‌شده هدر نمی‌رود.</p>
            )}
          </PackagePriceCard>

          {/* گزینه‌های پرداخت — کارمزد ۵٪ همین‌جا نوشته می‌شود */}
          <div className="card-surface p-6">
            <h3 className="mb-3 font-display font-bold text-ink">گزینه‌های پرداخت</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5 rounded-xl border border-clay/40 p-3">
                <Landmark size={16} className="mt-0.5 shrink-0 text-terracotta-deep" />
                <div>
                  <div className="font-bold text-ink">درگاه بانکی (زرین‌پال)</div>
                  <div className="text-xs text-ink-muted">پرداخت امن آنلاین — فعال‌سازی پکیج بلافاصله پس از تأیید درگاه.</div>
                </div>
              </div>
              <div className="rounded-xl border border-gold/40 bg-gold/8 p-3 text-xs leading-6 text-ink">
                با خرید این پکیج، <b>کارمزد فروش شما {toFa(PLATFORM.vendor.proPackage.commissionRatePercent)}٪</b> می‌شود — به‌جای {toFa(PLATFORM.vendor.commissionRatePercent)}٪ پلتفرم. یعنی از هر فروش شما فقط {toFa(PLATFORM.vendor.proPackage.commissionRatePercent)}٪ کارمزد گرفته می‌شود، نه {toFa(PLATFORM.vendor.commissionRatePercent)}٪.
              </div>
              <Button className="w-full" variant="accent" disabled={busy || me.vendor.status !== "active"} onClick={buy}>
                {busy ? (<span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> در حال انتقال به درگاه…</span>) : state.active ? "تمدید / خرید دورهٔ بعدی" : "خرید پکیج — " + toFa(PLATFORM.vendor.proPackage.priceToman.toLocaleString("en-US")) + " تومان"}
              </Button>
              {me.vendor.status !== "active" && (
                <p className="text-2xs leading-5 text-warning">خرید پکیج پس از فعال شدن فروشگاه توسط مدیر امکان‌پذیر است.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DEMO — فقط 503+DEMO_MODE / قطع شبکه. پکیج فیک فعال نمی‌شود.
   ============================================================ */
function DemoPackagePage() {
  return (
    <div className="space-y-6">
      <div className="card-surface p-6">
        <h1 className="font-display text-xl font-black text-ink">پکیج فروشنده</h1>
        <p className="mt-1 text-sm text-ink-muted">این صفحه در حالت دمو است — خرید واقعی پس از راه‌اندازی سرور فعال می‌شود.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">با پکیج چه می‌شود؟</h3>
          <div className="space-y-3">
            {perkRows().map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl border border-clay/40 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/12 text-gold"><p.icon size={17} /></span>
                <div>
                  <div className="text-sm font-bold text-ink">{p.title}</div>
                  <p className="mt-1 text-xs leading-6 text-ink-muted">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <PackagePriceCard>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 p-3 text-xs leading-6">
              <Info size={14} className="mt-0.5 shrink-0 text-gold" />
              <span>در حالت دمو خرید غیرفعال است — هیچ پرداخت فیک ثبت نمی‌شود. با اتصال پایگاه‌داده و درگاه، همین دکمه واقعی می‌شود.</span>
            </div>
          </PackagePriceCard>
          <div className="card-surface p-6">
            <h3 className="mb-3 font-display font-bold text-ink">گزینه‌های پرداخت</h3>
            <div className="rounded-xl border border-gold/40 bg-gold/8 p-3 text-xs leading-6 text-ink">
              با خرید این پکیج، <b>کارمزد فروش شما {toFa(PLATFORM.vendor.proPackage.commissionRatePercent)}٪</b> می‌شود — به‌جای {toFa(PLATFORM.vendor.commissionRatePercent)}٪ پلتفرم.
            </div>
            <Button className="mt-3 w-full" variant="ghost" disabled>
              <Wallet size={14} /> خرید در حالت دمو غیرفعال است
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
