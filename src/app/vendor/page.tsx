"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingCart, DollarSign, Clock, Plus, CheckCircle2, Truck, ShieldCheck, Info, LogIn, Percent, Wallet, Store as StoreIcon, RefreshCw } from "lucide-react";
import { Button, Badge, LogoBlock, Spinner } from "@/components/ui/primitives";
import { toFa, formatCompactFa, formatPrice } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { useUi } from "@/stores/useApp";
import { vendorStats, listVendorOrdersWithBuyers, vendorStoreProfile, vendorProductCount, type VendorOrderRow } from "@/data/vendorSession";
import {
  fetchVendorMeCached,
  fetchVendorEarnings,
  vendorOnboard,
  invalidateVendorMeCache,
  isDemoFallback,
  toman,
  faDate,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_TONE,
  VERIFICATION_LABEL,
  VERIFICATION_LOG_LABEL,
  type VendorMe,
  type VendorEarningRow,
  type EarningsSummary,
} from "@/lib/vendorClient";
import { PLATFORM } from "@/config/platform";

const ORDER_STATUS_LABEL: Record<string, string> = { delivered: "تحویل شده", shipping: "در حال ارسال", processing: "در حال پردازش", cancelled: "لغو شده" };
const ORDER_STATUS_TONE: Record<string, "success" | "accent" | "gold" | "dark"> = { delivered: "success", shipping: "accent", processing: "gold", cancelled: "dark" };

type Mode =
  | { kind: "loading" }
  | { kind: "real"; me: VendorMe }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "onboard" }
  | { kind: "onboarded" }
  | { kind: "suspended"; message: string }
  | { kind: "error"; message: string };

export default function VendorDashboard() {
  // Real backend first — the demo store below is ONLY a fallback for
  // DB-less deployments (503 DEMO_MODE) or a dead network (status 0).
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void fetchVendorMeCached().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real", me: res.data });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else if (res.status === 403 && res.message?.includes("تعلیق")) setMode({ kind: "suspended", message: res.message });
      else if (res.status === 403) setMode({ kind: "onboard" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت اطلاعات فروشگاه…</div>;
  }
  if (mode.kind === "demo") return <DemoDashboard />;
  if (mode.kind === "auth") return <AuthCard />;
  if (mode.kind === "suspended") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">فروشگاه شما تعلیق شده است</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message} برای پیگیری با پشتیبانی هومینو در تماس باشید.</p>
      </div>
    );
  }
  if (mode.kind === "onboard") return <OnboardForm onDone={() => setMode({ kind: "onboarded" })} />;
  if (mode.kind === "onboarded") {
    return (
      <div className="card-surface p-8 text-center">
        <ShieldCheck size={26} className="mx-auto text-success" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">در انتظار تأیید مدیر</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">
          فروشگاه شما ثبت شد و در صف بررسی مدیر هومینو است. پس از تأیید، همین پنل با دادهٔ واقعی فعال می‌شود.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-terracotta-deep underline">بازگشت به فروشگاه ←</Link>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت اطلاعات فروشگاه</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealDashboard me={mode.me} />;
}

/* ============================================================
   REAL DASHBOARD — دادهٔ واقعی از /api/vendor/me + /api/vendor/earnings
   ============================================================ */

function RealDashboard({ me }: { me: VendorMe }) {
  const { vendor, summary } = me;
  const rate = vendor.commissionRatePercent ?? PLATFORM.vendor.commissionRatePercent;
  // Ledger rows → exact gross/commission sums. The summary endpoint only
  // carries NET numbers; the ledger fetch is real data, never derived math.
  const [ledger, setLedger] = useState<{ items: VendorEarningRow[]; summary: EarningsSummary } | null>(null);
  const [ledgerFailed, setLedgerFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchVendorEarnings(1, 50).then((res) => {
      if (!alive) return;
      if (res.ok) setLedger(res.data);
      else setLedgerFailed(true);
    });
    return () => { alive = false; };
  }, []);

  const gross = ledger?.items.reduce((s, r) => s + r.grossToman, 0) ?? null;
  const commission = ledger?.items.reduce((s, r) => s + r.commissionToman, 0) ?? null;
  const ledgerPartial = ledger ? ledger.summary.itemCount > ledger.items.length : false;

  const tiles = [
    { label: "فروش ناخالص", value: gross !== null ? `${toFa(formatCompactFa(gross))} ت` : "—", icon: DollarSign },
    { label: "کمیسیون پلتفرم", value: commission !== null ? `${toFa(formatCompactFa(commission))} ت` : "—", icon: Percent },
    { label: "خالص قابل تسویه", value: `${toFa(formatCompactFa(summary.available))} ت`, icon: Wallet },
    { label: "در انتظار تسویه", value: `${toFa(formatCompactFa(summary.pending))} ت`, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <LogoBlock char={vendor.name[0] ?? "ف"} color="#c2703f" size={52} />
          <div>
            <h1 className="font-display text-xl font-black text-ink">خوش آمدی، {vendor.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={VENDOR_STATUS_TONE[vendor.status] ?? "neutral"}>{VENDOR_STATUS_LABEL[vendor.status] ?? vendor.status}</Badge>
              <Badge tone={vendor.verificationStatus === "verified" ? "success" : "gold"}>{VERIFICATION_LABEL[vendor.verificationStatus] ?? vendor.verificationStatus}</Badge>
              <Badge tone="accent">کمیسیون {toFa(rate)}٪</Badge>
            </div>
          </div>
        </div>
        <Link href="/vendor/products"><Button><Plus size={16} /> افزودن محصول</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between"><s.icon size={20} className="text-ink-muted" /></div>
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-2xs text-ink-muted">
        <span className="rounded-lg border border-clay/40 bg-ivory-2 px-3 py-1.5">در جریان تسویه: {toman(summary.settling)}</span>
        <span className="rounded-lg border border-clay/40 bg-ivory-2 px-3 py-1.5">تسویه‌شده تا امروز: {toman(summary.paid)}</span>
        <span className="rounded-lg border border-clay/40 bg-ivory-2 px-3 py-1.5">مجموع خالص فروش: {toman(summary.totalNet)}</span>
        <span className="rounded-lg border border-clay/40 bg-ivory-2 px-3 py-1.5">سطرهای صورت‌حساب: {toFa(summary.itemCount)}</span>
        <span className="rounded-lg border border-clay/40 bg-ivory-2 px-3 py-1.5">
          اطلاعات تسویهٔ بانکی: {me.payoutSettings?.shaba || me.payoutSettings?.cardNumber ? "ثبت شده" : "ثبت نشده"} — <Link href="/vendor/store" className="underline text-terracotta-deep">تنظیمات فروشگاه ←</Link>
        </span>
      </div>

      {ledgerPartial && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-2.5 text-xs leading-6 text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-gold" />
          <span>فروش ناخالص و کمیسیون روی {toFa(ledger?.items.length ?? 0)} سطر اخیر صورت‌حساب محاسبه شده‌اند (کل: {toFa(summary.itemCount)} سطر) — ارقام دقیق‌تر در «تحلیل و گزارش».</span>
        </p>
      )}
      {ledgerFailed && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-2.5 text-xs leading-6 text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-danger" />
          <span>صورت‌حساب کمیسیون همین حالا در دسترس نیست — کارت‌های خالص از خلاصهٔ واقعی سرور می‌آیند.</span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">صورت‌حساب اخیر</h3>
          <div className="space-y-2">
            {(ledger?.items ?? []).slice(0, 5).map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-clay/40 p-3">
                <div>
                  <div className="text-sm font-medium text-ink">سفارش {toFa(row.orderId.slice(0, 8))}</div>
                  <div className="text-xs text-ink-muted">{faDate(row.createdAt)} · خالص {toman(row.netToman)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-ink">{toman(row.grossToman)}</span>
                  <Badge tone="neutral">{toFa(row.commissionBp / 100)}٪ کمیسیون</Badge>
                </div>
              </div>
            ))}
            {ledger && ledger.items.length === 0 && <p className="text-sm text-ink-muted">هنوز صورت‌حسابی ثبت نشده — با اولین سفارشِ پرداخت‌شده اینجا می‌آید.</p>}
            {ledgerFailed && <p className="text-sm text-ink-muted">فهرست صورت‌حساب در دسترس نیست.</p>}
          </div>
        </div>

        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">گزارش تأیید فروشگاه</h3>
          <div className="space-y-2">
            {me.verificationLog.length ? me.verificationLog.slice(0, 6).map((log, i) => (
              <div key={i} className="rounded-xl border border-clay/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-ink"><ShieldCheck size={13} className="text-sage" /> {VERIFICATION_LOG_LABEL[log.action] ?? log.action}</span>
                  <span className="text-2xs text-ink-muted">{faDate(log.createdAt)}</span>
                </div>
                {log.note && <p className="mt-1 text-xs leading-6 text-ink-muted">{log.note}</p>}
              </div>
            )) : (
              <p className="text-sm text-ink-muted">هنوز اقدامی در پروندهٔ تأیید ثبت نشده است.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ONBOARDING — 403 (کاربر واقعی بدون فروشگاه) → فرم ثبت فروشگاه
   ============================================================ */

const onbInput = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

function OnboardForm({ onDone }: { onDone: () => void }) {
  const { toast } = useUi();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const city = String(fd.get("city") ?? "").trim();
    if (name.length < 2) { setErr("نام فروشگاه حداقل ۲ کاراکتر است"); return; }
    setSaving(true);
    void vendorOnboard({ name, city: city || undefined }).then((res) => {
      setSaving(false);
      if (res.ok) {
        invalidateVendorMeCache();
        toast("فروشگاه شما ثبت شد و در انتظار تأیید مدیر است", "success");
        onDone();
      } else {
        setErr(res.message ?? "ثبت فروشگاه ناموفق بود");
      }
    });
  }

  return (
    <div className="card-surface p-8">
      <div className="mx-auto max-w-md text-center">
        <StoreIcon size={26} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">فروشگاهت را بساز</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          حساب شما به هیچ فروشگاه فروشنده‌ای متصل نیست. با ثبت نام فروشگاه، پروندهٔ شما برای تأیید مدیر هومینو باز می‌شود.
        </p>
      </div>
      <form onSubmit={submit} className="mx-auto mt-5 grid max-w-md gap-4">
        <div>
          <label htmlFor="onb-name" className="mb-1.5 block text-sm font-medium text-ink">نام فروشگاه <span className="text-danger">*</span></label>
          <input id="onb-name" name="name" required minLength={2} placeholder="مثلاً: مبلمان رویال" className={onbInput} />
        </div>
        <div>
          <label htmlFor="onb-city" className="mb-1.5 block text-sm font-medium text-ink">شهر</label>
          <input id="onb-city" name="city" placeholder="مثلاً: تهران" className={onbInput} />
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" disabled={saving}>{saving ? <><Spinner /> در حال ثبت…</> : <><StoreIcon size={16} /> ثبت فروشگاه</>}</Button>
        <p className="text-2xs leading-6 text-ink-muted">پس از ثبت، وضعیت فروشگاه «در انتظار تأیید مدیر» می‌شود و پنل پس از تأیید فعال خواهد شد.</p>
      </form>
    </div>
  );
}

function AuthCard() {
  return (
    <div className="card-surface p-8 text-center">
      <LogIn size={22} className="mx-auto text-terracotta-deep" />
      <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">پنل فروشنده به حساب کاربری شما متصل است. برای دیدن دادهٔ واقعی فروشگاه، وارد شوید.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/login?next=%2Fvendor"><Button>ورود به حساب</Button></Link>
        <Link href="/register"><Button variant="outline">ثبت‌نام فروشنده</Button></Link>
      </div>
    </div>
  );
}

/* ============================================================
   DEMO DASHBOARD — fallback صادقانه فقط برای ۵۰۳ DEMO_MODE / قطعی شبکه.
   دقیقاً همان رفتار قبلی (vendorSession) حفظ شده است.
   ============================================================ */

function DemoDashboard() {
  const hydrated = useHasHydrated();
  // persisted session (products/profile/statuses) lands right after hydration
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // Session seeds render first; buyer-placed orders merge in after hydration
  // so SSR and the first client paint stay identical (zero console mismatch).
  const stats = vendorStats(hydrated);
  const profile = vendorStoreProfile();
  const rows: VendorOrderRow[] = hydrated ? listVendorOrdersWithBuyers() : listVendorOrdersWithBuyers().filter((row) => !row.fromBuyer);
  const recent = rows.slice(0, 4);
  // Bars derive from the 12 most recent order totals — not a hardcoded array.
  const bars = (() => {
    const totals = rows.map(({ total }) => total);
    const last12 = totals.slice(0, 12);
    if (!last12.length) return [];
    const max = Math.max(...last12);
    return last12.map((total) => Math.max(12, Math.round((total / max) * 100)));
  })();
  const tiles = [
    { label: "فروش این ماه", value: `${toFa(formatCompactFa(stats.monthSales))} ت`, icon: DollarSign },
    { label: "سفارش‌ها", value: toFa(stats.ordersCount), icon: ShoppingCart },
    { label: "محصولات فعال", value: toFa(stats.activeProductCount), icon: Package },
    { label: "در انتظار پردازش", value: toFa(stats.processingCount), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <LogoBlock char={profile.logoChar} color={profile.logoColor} size={52} />
          <div><h1 className="font-display text-xl font-black text-ink">خوش آمدی، {profile.name}</h1><p className="text-sm text-ink-muted">نمای کلی فروش این ماه</p></div>
        </div>
        <Link href="/vendor/products/new"><Button><Plus size={16} /> افزودن محصول</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between">
              <s.icon size={20} className="text-ink-muted" />
            </div>
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-surface p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-display font-bold text-ink">سفارش‌های اخیر</h3><Link href="/vendor/orders" className="text-sm text-terracotta-deep">همه ←</Link></div>
          <div className="space-y-2">
            {recent.length ? recent.map(({ order, total }) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-clay/40 p-3">
                <div><div className="text-sm font-medium text-ink">#{toFa(order.id)}</div><div className="text-xs text-ink-muted">{order.customer} · {toFa(order.lines.reduce((n, l) => n + l.qty, 0))} کالا</div></div>
                <div className="flex items-center gap-3"><span className="text-sm font-bold text-ink">{toFa(formatPrice(total))} ت</span><Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge></div>
              </div>
            )) : <p className="text-sm text-ink-muted">هنوز سفارشی ثبت نشده است.</p>}
          </div>
        </div>
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">عملکرد فروش</h3>
          <div className="flex h-40 items-end justify-between gap-1.5">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-terracotta to-terracotta-soft transition hover:opacity-80" style={{ height: `${h}%` }} title={`سفارش ${toFa(i + 1)}`} />
            ))}
          </div>
          <div className="mt-3 text-center text-xs text-ink-muted">ارتفاع میله‌ها از مبلغ ۱۲ سفارش آخر محاسبه می‌شود</div>
          <div className="mt-4 space-y-2 border-t border-clay/40 pt-3 text-xs text-ink-muted">
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-sage" /> تحویل‌شده</span><b className="text-ink">{toFa(stats.deliveredCount)}</b></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Truck size={13} className="text-terracotta-deep" /> در حال ارسال</span><b className="text-ink">{toFa(stats.shippingCount)}</b></div>
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-2xs text-ink-muted"><RefreshCw size={11} /> محصولات ثبت‌شده: {toFa(vendorProductCount())} — حالت دمو: این پنل از منبع دادهٔ محلی (vendorSession) تغذیه می‌شود و پس از اتصال سرور، دادهٔ واقعی جای آن را می‌گیرد.</p>
    </div>
  );
}
