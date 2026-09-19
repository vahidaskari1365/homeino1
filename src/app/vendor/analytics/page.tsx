"use client";
import { useEffect, useState } from "react";
import { Percent, Wallet, Info, LogIn, HandCoins } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { useUi } from "@/stores/useApp";
import { vendorStats, listVendorOrdersWithBuyers } from "@/data/vendorSession";
import { PLATFORM } from "@/config/platform";
import {
  fetchVendorMeCached,
  fetchVendorEarnings,
  fetchVendorPayouts,
  requestVendorPayout,
  isDemoFallback,
  toman,
  faDate,
  EARNING_STATUS_LABEL,
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_TONE,
  type EarningsSummary,
  type VendorEarningRow,
  type VendorPayoutRow,
} from "@/lib/vendorClient";

type Mode =
  | { kind: "loading" }
  | { kind: "real"; ratePercent: number }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function VendorAnalyticsPage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  // Real backend first — the demo cards below are ONLY a fallback for DB-less
  // deployments (503 DEMO_MODE) or a dead network (status 0).
  useEffect(() => {
    let alive = true;
    void fetchVendorMeCached().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real", ratePercent: res.data.vendor.commissionRatePercent ?? PLATFORM.vendor.commissionRatePercent });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت گزارش مالی…</div>;
  }
  if (mode.kind === "demo") return <DemoAnalyticsPage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">گزارش مالی واقعی فروشگاه فقط با ورود به حساب کاربری دیده می‌شود.</p>
        <a href="/login?next=%2Fvendor%2Fanalytics" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت گزارش مالی</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealAnalyticsPage ratePercent={mode.ratePercent} />;
}

/* ============================================================
   REAL ANALYTICS — /api/vendor/earnings + /api/vendor/payouts
   همهٔ مبالغ «تومان» صحیح از سرور؛ هیچ عددی اینجا ساخته نمی‌شود.
   ============================================================ */

function RealAnalyticsPage({ ratePercent }: { ratePercent: number }) {
  const { toast } = useUi();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [ledger, setLedger] = useState<VendorEarningRow[]>([]);
  const [payouts, setPayouts] = useState<VendorPayoutRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [requesting, setRequesting] = useState(false);
  // Manual refresh trigger — after a payout request the effect refetches
  // (setState stays out of the effect body — repo lint rule).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchVendorEarnings(1, 20).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setSummary(res.data.summary);
        setLedger(res.data.items);
        setLoadError("");
      } else {
        setLoadError(res.message ?? "دریافت صورت‌حساب ناموفق بود");
      }
    });
    void fetchVendorPayouts(1, 20).then((res) => {
      if (!alive) return;
      if (res.ok) setPayouts(res.data.items);
    });
    return () => { alive = false; };
  }, [tick]);

  // Render-phase default (repo pattern, see vendor/store demo form): the first
  // time the REAL summary lands, adopt it as the amount input's default.
  if (summary && !amountTouched && amount === "") {
    setAmount(String(summary.available));
  }

  async function submitPayout() {
    // Persian/Arabic digits → English, then keep digits only.
    const normalized = amount
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const value = Number(normalized.replace(/\D/g, ""));
    if (!value || value <= 0) { toast("مبلغ درخواستی معتبر نیست", "error"); return; }
    setRequesting(true);
    const res = await requestVendorPayout({ amountToman: value });
    setRequesting(false);
    if (res.ok) {
      toast(`درخواست تسویهٔ ${toman(res.data.amountToman)} ثبت شد و در انتظار بررسی مدیر است`, "success");
      setTick((t) => t + 1);
    } else {
      // below_minimum / insufficient / no_available — پیام صادقانهٔ سرور
      toast(res.message ?? "درخواست تسویه ناموفق بود", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تحلیل و گزارش</h1>
      <p className="text-sm text-ink-muted">
        صورت‌حساب کمیسیون واقعی شما از سرور هومینو می‌آید — نرخ کمیسیون {toFa(ratePercent)}٪ روی هر فروش و تسویه پس از تحویل سفارش.
      </p>

      {loadError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-2.5 text-sm text-ink">
          <Info size={15} className="mt-0.5 shrink-0 text-danger" /> {loadError}
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card-surface p-5">
            <div className="font-display text-xl font-black text-ink">{toFa(formatPrice(summary.available))}</div>
            <div className="text-xs text-ink-muted">خالص قابل تسویه (تومان)</div>
          </div>
          <div className="card-surface p-5">
            <div className="font-display text-xl font-black text-ink">{toFa(formatPrice(summary.pending))}</div>
            <div className="text-xs text-ink-muted">در انتظار تحویل (تومان)</div>
          </div>
          <div className="card-surface p-5">
            <div className="font-display text-xl font-black text-ink">{toFa(formatPrice(summary.settling))}</div>
            <div className="text-xs text-ink-muted">در جریان تسویه (تومان)</div>
          </div>
          <div className="card-surface p-5">
            <div className="font-display text-xl font-black text-ink">{toFa(formatPrice(summary.paid))}</div>
            <div className="text-xs text-ink-muted">تسویه شده (تومان)</div>
          </div>
        </div>
      )}

      {/* درخواست تسویه — POST /api/vendor/payouts */}
      <div className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><HandCoins size={18} className="text-terracotta-deep" /> درخواست تسویه</div>
          <Badge tone="accent">{toFa(ratePercent)}٪ کمیسیون پلتفرم</Badge>
        </div>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          مبلغ پیش‌فرض، کل موجودیِ قابل تسویه است. حداقل مبلغ تسویه {toFa(PLATFORM.vendor.minPayoutToman.toLocaleString("en-US"))} تومان است ({PLATFORM.vendor.payoutScheduleLabel}).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }}
            inputMode="numeric"
            dir="ltr"
            aria-label="مبلغ درخواست تسویه (تومان)"
            className="w-48 rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink"
            placeholder="مبلغ به تومان"
          />
          <Button disabled={requesting || !summary || summary.available <= 0} onClick={() => void submitPayout()}>
            {requesting ? <><Spinner /> در حال ثبت…</> : "ثبت درخواست تسویه"}
          </Button>
          {summary && summary.available <= 0 && <span className="text-xs text-ink-muted">موجودی قابل تسویه‌ای وجود ندارد — ابتدا سفارش‌ها باید تحویل شوند.</span>}
        </div>
      </div>

      {/* صورت‌حساب کمیسیون */}
      <div className="overflow-hidden card-surface">
        <div className="border-b border-clay/40 bg-ivory-2 px-4 py-3 font-display font-bold text-ink">صورت‌حساب کمیسیون</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              <th className="p-3 font-medium">تاریخ</th><th className="p-3 font-medium">ناخالص</th><th className="p-3 font-medium">کمیسیون</th><th className="p-3 font-medium">خالص</th><th className="p-3 font-medium">وضعیت</th>
            </tr></thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3 whitespace-nowrap text-ink-muted">{faDate(row.createdAt)}</td>
                  <td className="p-3 whitespace-nowrap text-ink">{toman(row.grossToman)}</td>
                  <td className="p-3 whitespace-nowrap text-ink-muted">{toman(row.commissionToman)} <span className="text-2xs">({toFa(row.commissionBp / 100)}٪)</span></td>
                  <td className="p-3 whitespace-nowrap font-bold text-ink">{toman(row.netToman)}</td>
                  <td className="p-3"><Badge tone={row.status === "paid" ? "success" : row.status === "available" ? "accent" : row.status === "reversed" ? "dark" : "gold"}>{EARNING_STATUS_LABEL[row.status] ?? row.status}</Badge></td>
                </tr>
              ))}
              {!ledger.length && !loadError && <tr><td colSpan={5} className="p-8 text-center text-sm text-ink-muted">هنوز صورت‌حسابی ثبت نشده — با اولین سفارشِ پرداخت‌شده اینجا می‌آید.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* تاریخچهٔ درخواست‌های تسویه */}
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">تاریخچهٔ درخواست‌های تسویه</h3>
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-clay/40 p-3">
              <div>
                <div className="text-sm font-bold text-ink">{toman(p.amountToman)}</div>
                <div className="text-2xs text-ink-muted">{faDate(p.createdAt)}{p.processedAt ? ` · بررسی: ${faDate(p.processedAt)}` : ""}{p.reference ? ` · شماره پیگیری: ${toFa(p.reference)}` : ""}</div>
              </div>
              <Badge tone={PAYOUT_STATUS_TONE[p.status] ?? "neutral"}>{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</Badge>
            </div>
          ))}
          {!payouts.length && <p className="text-sm text-ink-muted">هنوز درخواست تسویه‌ای ثبت نکرده‌ای.</p>}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-clay/40 bg-ivory-2 p-3 text-2xs leading-6 text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-terracotta-deep" />
        <span>وضعیت هر سطر صورت‌حساب: «در انتظار تحویل» یعنی سفارش هنوز به دست خریدار نرسیده؛ پس از تحویل، مبلغ «قابل تسویه» و پس از تأیید واریز مدیر «تسویه شده» می‌شود.</span>
      </div>
    </div>
  );
}

/* ============================================================
   DEMO ANALYTICS — fallback صادقانه (۵۰۳ DEMO_MODE / قطعی شبکه).
   همان دو کارت کمیسیون/تسویهٔ قبلی از vendorStats (دموی محلی).
   ============================================================ */

function DemoAnalyticsPage() {
  const hydrated = useHasHydrated();
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // Money cards = real orders (session seeds + buyer-placed ones after hydration).
  const stats = vendorStats(hydrated);
  const rows = hydrated ? listVendorOrdersWithBuyers() : listVendorOrdersWithBuyers().filter((row) => !row.fromBuyer);
  // Bars derive from the 12 most recent order totals — not a hardcoded array.
  const bars = (() => {
    const totals = rows.map(({ total }) => total).slice(0, 12);
    if (!totals.length) return [];
    const max = Math.max(...totals);
    return totals.map((total) => Math.max(10, Math.round((total / max) * 100)));
  })();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تحلیل و گزارش</h1>
      <p className="text-sm text-ink-muted">
        حالت دمو: ستون تسویهٔ مالی از سفارش‌های نمونهٔ همین فروشگاه محاسبه می‌شود ({PLATFORM.vendor.commissionRatePercent}٪ ثابت در config). پس از اتصال سرور، صورت‌حساب واقعی جایگزین می‌شود.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card-surface p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-ink"><Percent size={18} className="text-terracotta-deep" /> کمیسیون پلتفرم</div>
            <Badge>{toFa(PLATFORM.vendor.commissionRatePercent)}٪ از فروش</Badge>
          </div>
          <div className="mt-3 font-display text-2xl font-black text-ink">{toFa(formatPrice(stats.platformCommission))} <span className="text-sm font-normal text-ink-muted">تومان</span></div>
          <p className="mt-2 text-xs leading-6 text-ink-muted">محاسبه‌شده روی {toFa(stats.deliveredCount)} سفارش تحویل‌شدهٔ این دوره (نمونه). سقف/پله‌های کمیسیون پس از اتصال به سامانهٔ واقعی تسویه اعمال می‌شود.</p>
        </div>

        <div className="card-surface p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><Wallet size={18} className="text-terracotta-deep" /> ماندهٔ تسویه</div>
          <div className="mt-3 font-display text-2xl font-black text-ink">{toFa(formatPrice(stats.settlementBalance))} <span className="text-sm font-normal text-ink-muted">تومان</span></div>
          <p className="mt-2 text-xs leading-6 text-ink-muted">معادل فروش تحویل‌شده پس از کسر کمیسیون پلتفرم — نمایشی در حالت دمو و هنوز قابل برداشت نیست.</p>
        </div>
      </div>

      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">روند فروش</h3>
        <div className="flex h-48 items-end justify-between gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="group relative flex-1 rounded-t bg-gradient-to-t from-ink to-ink-soft transition hover:from-terracotta hover:to-terracotta-deep" style={{ height: `${h}%` }}><span className="absolute -top-5 right-1/2 translate-x-1/2 text-2xs text-ink-muted opacity-0 group-hover:opacity-100">{toFa(h)}</span></div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">ارتفاع میله‌ها از مبلغ ۱۲ سفارش آخر همین فروشگاه محاسبه می‌شود</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-clay/40 bg-ivory-2 p-3 text-2xs leading-6 text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-terracotta-deep" />
        <span>گزارش‌های پیشرفته (بازدید، نرخ تبدیل، محبوب‌ترین محصول) بعد از راه‌اندازی پنل تحلیلی واقعی اضافه می‌شوند؛ در این دمو آمارهای مالی فقط از سفارش‌های واقعی همین فروشگاه نمونه محاسبه شده‌اند.</span>
      </div>
    </div>
  );
}
