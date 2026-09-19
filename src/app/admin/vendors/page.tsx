"use client";
import { useEffect, useState } from "react";
import { Badge, LogoBlock, Button, Spinner } from "@/components/ui/primitives";
import { stores } from "@/data/stores";
import { productsByStore } from "@/data/products";
import { listPendingVendors, decideVendorApplication } from "@/data/vendorRegistrations";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { LogIn, Info, Banknote } from "lucide-react";
import {
  fetchAdminVendors,
  adminVendorAction,
  fetchAdminPayouts,
  adminPayoutAction,
  isDemoFallback,
  toman,
  faDate,
  bpToPercentLabel,
  VENDOR_STATUS_LABEL,
  VENDOR_STATUS_TONE,
  VERIFICATION_LABEL,
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_TONE,
  type AdminVendorRow,
  type AdminPayoutRow,
} from "@/lib/vendorClient";

type Mode =
  | { kind: "loading" }
  | { kind: "real" }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function AdminVendorsPage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  // Real backend first — the localStorage demo list below is ONLY a fallback
  // for DB-less deployments (503 DEMO_MODE) or a dead network (status 0).
  useEffect(() => {
    let alive = true;
    void fetchAdminVendors().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real" });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت فهرست فروشگاه‌ها…</div>;
  }
  if (mode.kind === "demo") return <DemoAdminVendorsPage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">دسترسی مدیر لازم است</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">برای مشاهده و تصمیم‌گیری دربارهٔ فروشگاه‌ها، با حساب مدیر وارد شوید.</p>
        <a href="/login?next=%2Fadmin%2Fvendors" className="mt-4 inline-block"><Button>ورود مدیر</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت فهرست فروشگاه‌ها</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealAdminVendorsPage />;
}

/* ============================================================
   REAL ADMIN — GET/POST /api/admin/vendors + GET/POST /api/admin/payouts
   ============================================================ */

function RealAdminVendorsPage() {
  const { toast } = useUi();
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payRefFor, setPayRefFor] = useState<string | null>(null); // payoutId با اینپوت مرجع باز
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchAdminVendors().then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) {
        setVendors(res.data.items);
        setLoadError("");
      } else {
        setLoadError(res.message ?? "دریافت فهرست فروشگاه‌ها ناموفق بود");
      }
    });
    void fetchAdminPayouts().then((res) => {
      if (!alive) return;
      if (res.ok) setPayouts(res.data.items);
    });
    return () => { alive = false; };
  }, []);

  async function reload() {
    const [vRes, pRes] = await Promise.all([fetchAdminVendors(), fetchAdminPayouts()]);
    if (vRes.ok) {
      setVendors(vRes.data.items);
      setLoadError("");
    } else {
      setLoadError(vRes.message ?? "دریافت فهرست فروشگاه‌ها ناموفق بود");
    }
    if (pRes.ok) setPayouts(pRes.data.items);
  }

  async function act(vendor: AdminVendorRow, action: "approve" | "reject" | "suspend" | "reactivate" | "verify" | "unverify") {
    setBusyId(vendor.id);
    const res = await adminVendorAction(vendor.id, { action });
    setBusyId(null);
    if (res.ok) {
      const label: Record<string, string> = {
        approve: "فروشگاه تأیید و فعال شد",
        reject: "درخواست فروشگاه رد شد",
        suspend: "فروشگاه تعلیق شد",
        reactivate: "فروشگاه دوباره فعال شد",
        verify: "هویت فروشگاه تأیید شد",
        unverify: "تأیید هویت لغو شد",
      };
      toast(label[action], "success");
      await reload();
    } else {
      toast(res.message ?? "انجام عملیات ناموفق بود", "error");
    }
  }

  async function payoutAct(payout: AdminPayoutRow, action: "approve" | "reject" | "mark_paid") {
    if (action === "mark_paid" && !payRef.trim()) {
      toast("شماره پیگیری واریز را وارد کن", "error");
      return;
    }
    setBusyId(payout.id);
    const res = await adminPayoutAction(payout.id, {
      action,
      reference: action === "mark_paid" ? payRef.trim() : undefined,
    });
    setBusyId(null);
    setPayRefFor(null);
    setPayRef("");
    if (res.ok) {
      const label: Record<string, string> = { approve: "درخواست تسویه تأیید شد", reject: "درخواست تسویه رد شد و موجودی به فروشنده برگشت", mark_paid: "واریز ثبت شد و تسویه تکمیل شد" };
      toast(label[action], "success");
      await reload();
    } else {
      toast(res.message ?? "انجام عملیات ناموفق بود", "error");
    }
  }

  const pendingCount = vendors.filter((v) => v.status === "pending").length;

  return (
    <div className="space-y-8">
      {loadError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-2.5 text-sm text-ink">
          <Info size={15} className="mt-0.5 shrink-0 text-danger" /> {loadError}
        </p>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-xl font-black text-ink">فروشگاه‌های بازارگاه (دادهٔ واقعی)</h1>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && <Badge tone="gold">{toFa(pendingCount)} در انتظار بررسی</Badge>}
            <Badge tone="success">{toFa(vendors.length)} فروشگاه</Badge>
          </div>
        </div>
        <div className="overflow-hidden card-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
                <th className="p-3 font-medium">فروشگاه</th><th className="p-3 font-medium">مالک</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium">هویت</th><th className="p-3 font-medium">کمیسیون</th><th className="p-3 font-medium">خالص در جریان</th><th className="p-3 font-medium">ثبت</th><th className="p-3 font-medium">اقدام</th>
              </tr></thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-clay/30 align-top hover:bg-ivory-2/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <LogoBlock char={v.name[0] ?? "ف"} color="#c2703f" size={32} />
                        <div>
                          <div className="font-medium text-ink">{v.name}</div>
                          <div className="text-2xs text-ink-muted" dir="ltr">{v.slug}{v.city ? ` · ${v.city}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-2xs text-ink-muted" dir="ltr">{v.ownerEmail ?? "—"}</td>
                    <td className="p-3"><Badge tone={VENDOR_STATUS_TONE[v.status] ?? "neutral"}>{VENDOR_STATUS_LABEL[v.status] ?? v.status}</Badge></td>
                    <td className="p-3">
                      <Badge tone={v.verificationStatus === "verified" ? "success" : "gold"}>{VERIFICATION_LABEL[v.verificationStatus] ?? v.verificationStatus}</Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap text-ink">{bpToPercentLabel(v.commissionRateBp)}</td>
                    <td className="p-3 whitespace-nowrap text-ink">{toman(v.pendingNetToman)}</td>
                    <td className="p-3 whitespace-nowrap text-2xs text-ink-muted">{faDate(v.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {(v.status === "pending" || v.status === "rejected") && (
                          <Button size="sm" disabled={busyId === v.id} onClick={() => void act(v, "approve")}>تأیید فروشگاه</Button>
                        )}
                        {v.status === "pending" && (
                          <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => void act(v, "reject")}>رد</Button>
                        )}
                        {v.status === "active" && (
                          <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => void act(v, "suspend")}>تعلیق</Button>
                        )}
                        {v.status === "suspended" && (
                          <Button size="sm" disabled={busyId === v.id} onClick={() => void act(v, "reactivate")}>فعال‌سازی</Button>
                        )}
                        {v.verificationStatus !== "verified" ? (
                          <Button size="sm" variant="soft" disabled={busyId === v.id} onClick={() => void act(v, "verify")}>تأیید هویت</Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => void act(v, "unverify")}>لغو تأیید هویت</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!vendors.length && !loading && (
                  <tr><td colSpan={8} className="p-8 text-center text-sm text-ink-muted">هنوز فروشگاهی ثبت نشده است — پس از ثبت‌نام فروشنده‌ها اینجا می‌آیند.</td></tr>
                )}
                {loading && <tr><td colSpan={8} className="p-8 text-center text-sm text-ink-muted"><Spinner /> در حال بروزرسانی…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* درخواست‌های تسویه — REAL payout queue */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-ink flex items-center gap-2"><Banknote size={18} className="text-terracotta-deep" /> درخواست‌های تسویهٔ فروشنده‌ها</h2>
          <Badge tone={payouts.some((p) => p.status === "requested") ? "gold" : "neutral"}>
            {toFa(payouts.filter((p) => p.status === "requested").length)} در انتظار بررسی
          </Badge>
        </div>
        {payouts.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-ink-muted">درخواست تسویه‌ای ثبت نشده است.</div>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div key={p.id} className="card-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LogoBlock char={(p.vendorName ?? "ف")[0] ?? "ف"} color="#c2703f" size={36} />
                    <div>
                      <div className="font-bold text-ink">{p.vendorName ?? "فروشگاه"}</div>
                      <div className="text-xs text-ink-muted">{toman(p.amountToman)} · {faDate(p.createdAt)}{p.reference ? ` · پیگیری: ${toFa(p.reference)}` : ""}</div>
                    </div>
                  </div>
                  <Badge tone={PAYOUT_STATUS_TONE[p.status] ?? "neutral"}>{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</Badge>
                </div>
                {p.note && <p className="mt-2 rounded-lg bg-ivory-2 px-3 py-2 text-xs leading-6 text-ink-muted">یادداشت فروشنده: {p.note}</p>}
                {(p.status === "requested" || p.status === "approved") && (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    {payRefFor === p.id ? (
                      <>
                        <input
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          dir="ltr"
                          placeholder="شماره پیگیری واریز"
                          aria-label="شماره پیگیری واریز"
                          className="w-52 rounded-xl border border-clay/60 bg-cream p-2 text-sm outline-none focus:border-ink"
                        />
                        <Button size="sm" disabled={busyId === p.id} onClick={() => void payoutAct(p, "mark_paid")}>ثبت واریز</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPayRefFor(null); setPayRef(""); }}>انصراف</Button>
                      </>
                    ) : (
                      <>
                        {p.status === "requested" && <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => void payoutAct(p, "approve")}>تأیید</Button>}
                        <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => { setPayRefFor(p.id); setPayRef(""); }}>واریز شد (ثبت پیگیری)</Button>
                        {p.status === "requested" && <Button size="sm" variant="danger" disabled={busyId === p.id} onClick={() => void payoutAct(p, "reject")}>رد</Button>}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DEMO ADMIN — fallback صادقانه (۵۰۳ DEMO_MODE / قطعی شبکه).
   دقیقاً همان رفتار قبلی (فهرست localStorage + کاتالوگ دمو).
   ============================================================ */

function DemoAdminVendorsPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const [version, setVersion] = useState(0);
  // Read localStorage only after hydration so the first paint matches SSR —
  // the list renders empty first, then the real persisted applications appear.
  const pending = hydrated ? listPendingVendors() : [];

  function decide(id: string, approved: boolean) {
    decideVendorApplication(id, approved);
    setVersion((v) => v + 1);
    toast(approved ? "درخواست تأیید شد (در دمو فقط از فهرست خارج شد)" : "درخواست رد شد");
  }

  return (
    <div className="space-y-8" data-pending-version={version}>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-xl font-black text-ink">فروشگاه‌های تأییدشده</h1>
          <Badge tone="success">{toFa(stores.length)} فروشگاه</Badge>
        </div>
        <div className="overflow-hidden card-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted"><th className="p-3 font-medium">فروشگاه</th><th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">وضعیت</th></tr></thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3"><div className="flex items-center gap-2"><LogoBlock char={s.logo} color={s.logoColor} size={32} /><span className="font-medium text-ink">{s.name}</span></div></td>
                  <td className="p-3 text-ink">{toFa(productsByStore(s.id).length)}</td>
                  <td className="p-3 text-ink">{toFa(s.rating.toFixed(1))}</td>
                  <td className="p-3">{s.verified ? <Badge tone="success">تأیید شده</Badge> : <Badge tone="gold">مدارک در حال بررسی</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-2xs text-ink-muted">حالت دمو: این فهرست از کاتالوگ محلی می‌آید و پس از اتصال سرور، دادهٔ واقعی فروشگاه‌ها جایگزین می‌شود.</p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-ink">درخواست‌های ثبت فروشگاه</h2>
          <Badge tone={pending.length ? "gold" : "neutral"}>{toFa(pending.length)} در انتظار بررسی</Badge>
        </div>
        {pending.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-ink-muted">درخواست در انتظاری نیست — از صفحهٔ «ثبت فروشگاه» یکی بساز تا اینجا بیاید.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((app) => (
              <div key={app.id} className="card-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><LogoBlock char={app.storeName[0] ?? "ف"} size={36} />
                    <div><div className="font-bold text-ink">{app.storeName}</div><div className="text-xs text-ink-muted">{app.ownerName} · {app.phone} · {app.city}</div></div>
                  </div>
                  <Badge tone="gold">در انتظار</Badge>
                </div>
                <p className="mt-2 rounded-lg bg-ivory-2 px-3 py-2 text-xs leading-6 text-ink-muted">{app.category} — {app.description || "بدون توضیح"}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-2xs text-ink-muted">
                  <span>درخواست در تاریخ {app.faRequestedAt}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decide(app.id, false)}>رد</Button>
                    <Button size="sm" onClick={() => decide(app.id, true)}>تأیید</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
