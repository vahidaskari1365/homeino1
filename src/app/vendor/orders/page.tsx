"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Inbox, LogIn, Info } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { listVendorOrdersWithBuyers, advanceVendorOrder, type VendorOrderRow } from "@/data/vendorSession";
import { getProductById } from "@/data/products";
import {
  fetchVendorOrders,
  advanceVendorOrderItem,
  legalNextItemStatuses,
  isDemoFallback,
  toman,
  faDate,
  ITEM_STATUS_LABEL,
  ITEM_TRANSITION_LABEL,
  type VendorItemStatus,
  type VendorOrderItemRow,
} from "@/lib/vendorClient";

const LABEL: Record<string, string> = { processing: "در حال پردازش", shipping: "در حال ارسال", delivered: "تحویل شده", cancelled: "لغو شده" };
const TONE: Record<string, "gold" | "accent" | "success" | "dark"> = { processing: "gold", shipping: "accent", delivered: "success", cancelled: "dark" };
const FILTERS = ["all", "processing", "shipping", "delivered", "cancelled"] as const;
const FILTER_FA: Record<string, string> = { all: "همه", processing: "در حال پردازش", shipping: "در حال ارسال", delivered: "تحویل شده", cancelled: "لغو شده" };

const REAL_FILTERS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
const REAL_FILTER_FA: Record<string, string> = {
  all: "همه",
  pending: "در انتظار تأیید",
  confirmed: "تأیید شده",
  processing: "در حال پردازش",
  shipped: "ارسال شده",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
};

type Mode =
  | { kind: "loading" }
  | { kind: "real" }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function VendorOrdersPage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  // Real backend first — the demo (vendorSession + buyer localStorage) below
  // is ONLY a fallback for DB-less deployments (503 DEMO_MODE) or dead network.
  useEffect(() => {
    let alive = true;
    void fetchVendorOrders().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real" });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت سفارش‌ها…</div>;
  }
  if (mode.kind === "demo") return <DemoOrdersPage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">سفارش‌های واقعی فروشگاه فقط با ورود به حساب کاربری دیده می‌شوند.</p>
        <a href="/login?next=%2Fvendor%2Forders" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت سفارش‌ها</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealOrdersPage />;
}

/* ============================================================
   REAL ORDERS — GET /api/vendor/orders + PATCH /api/vendor/orders/[itemId]
   فقط گذارهای مجاز: pending→confirmed→processing→shipped→delivered
   (لغو فقط از confirmed/processing — همان قانون سمت سرور)
   ============================================================ */

function RealOrdersPage() {
  const { toast } = useUi();
  const [filter, setFilter] = useState<(typeof REAL_FILTERS)[number]>("all");
  const [items, setItems] = useState<VendorOrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  // Manual refresh trigger — mutations bump it and the effect refetches
  // (setState stays out of the effect body — repo lint rule).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchVendorOrders(filter).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setLoadError("");
      } else {
        setLoadError(res.message ?? "دریافت سفارش‌ها ناموفق بود");
      }
    });
    return () => { alive = false; };
  }, [filter, tick]);

  function refresh() {
    setLoading(true);
    setTick((t) => t + 1);
  }

  async function advance(row: VendorOrderItemRow, next: VendorItemStatus) {
    setBusyId(row.itemId);
    const res = await advanceVendorOrderItem(row.itemId, next);
    setBusyId(null);
    setConfirmCancelId(null);
    if (res.ok) {
      toast(`وضعیت سفارش ${toFa(row.orderNumber)} به «${ITEM_STATUS_LABEL[next]}» تغییر کرد`, "success");
      refresh();
    } else {
      toast(res.message ?? "تغییر وضعیت ناموفق بود", "error");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">سفارش‌ها</h1>
      <div className="flex flex-wrap gap-2">
        {REAL_FILTERS.map((key) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === key ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink hover:border-ink"}`}>{REAL_FILTER_FA[key]}</button>
        ))}
      </div>

      {loadError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-2.5 text-sm text-ink">
          <Info size={15} className="mt-0.5 shrink-0 text-danger" /> {loadError}
        </p>
      )}

      {!loading && items.length === 0 && !loadError && (
        <div className="card-surface p-10 text-center text-sm text-ink-muted">سفارشی با این وضعیت نیست.</div>
      )}

      {loading && <div className="card-surface p-8 text-center text-sm text-ink-muted"><Spinner /> در حال دریافت…</div>}

      <div className="space-y-3">
        {items.map((row) => {
          const open = expanded === row.itemId;
          const nexts = legalNextItemStatuses(row.itemStatus);
          return (
            <div key={row.itemId} className="card-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setExpanded(open ? null : row.itemId)} className="flex items-center gap-2 text-right">
                  <ChevronLeft size={16} className={`text-ink-muted transition ${open ? "-rotate-90" : ""}`} />
                  <span className="font-bold text-ink">سفارش {toFa(row.orderNumber)}</span>
                  <Badge tone={row.itemStatus === "delivered" ? "success" : row.itemStatus === "cancelled" ? "dark" : row.itemStatus === "pending" ? "gold" : "accent"}>{ITEM_STATUS_LABEL[row.itemStatus]}</Badge>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">{row.title} · {toFa(row.quantity)} عدد · {faDate(row.placedAt)}</span>
                  <span className="font-bold text-ink">{toman(row.total)}</span>
                </div>
              </div>

              {open && (
                <div className="mt-3 space-y-2 border-t border-clay/40 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-clay/30 bg-ivory-2/60 px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{row.title}</span>
                    <span className="text-xs text-ink-muted">{toFa(row.quantity)} × {toman(row.unitPrice)} = {toman(row.total)}</span>
                  </div>
                  {row.customerNote && (
                    <p className="rounded-xl border border-gold/30 bg-gold/8 px-3 py-2 text-xs leading-6 text-ink">یادداشت خریدار: {row.customerNote}</p>
                  )}
                  <p className="text-2xs text-ink-muted">وضعیت کل سفارش نزد خریدار: {REAL_FILTER_FA[row.orderStatus] ?? row.orderStatus}</p>

                  {nexts.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      {nexts.map((next) =>
                        next === "cancelled" ? (
                          confirmCancelId === row.itemId ? (
                            <Button key={next} size="sm" variant="danger" disabled={busyId === row.itemId} onClick={() => void advance(row, next)}>تأیید لغو سفارش</Button>
                          ) : (
                            <Button key={next} size="sm" variant="outline" onClick={() => setConfirmCancelId(row.itemId)}>لغو سفارش</Button>
                          )
                        ) : (
                          <Button key={next} size="sm" disabled={busyId === row.itemId} onClick={() => void advance(row, next)}>{ITEM_TRANSITION_LABEL[next]}</Button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-2 text-2xs leading-6 text-ink-muted">
        <Inbox size={13} className="mt-0.5 shrink-0" />
        <span>
          این فهرست از سرور واقعی هومینو می‌آید؛ هر تغییر وضعیت همان لحظه در «سفارش‌های من» خریدار دیده می‌شود. لغو فقط پیش از ارسال مجاز است — <Link href="/account/orders" className="underline">سفارش‌های من (خریدار) ←</Link>
        </span>
      </p>
    </div>
  );
}

/* ============================================================
   DEMO ORDERS — fallback صادقانه (۵۰۳ DEMO_MODE / قطعی شبکه).
   رفتار قبلی (سیدهای سشن + سفارش خریدارِ localStorage) حفظ شده است.
   ============================================================ */

function DemoOrdersPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // Seeds render on the first paint; buyer-placed orders (localStorage) merge
  // in after hydration — the established hydration-safe pattern.
  const items: VendorOrderRow[] = hydrated ? listVendorOrdersWithBuyers() : listVendorOrdersWithBuyers().filter((row) => !row.fromBuyer);

  const list = items.filter(({ order }) => filter === "all" || order.status === filter);

  function advance(orderId: string) {
    const next = advanceVendorOrder(orderId);
    setVersion((v) => v + 1);
    const label = next ? LABEL[next] : null;
    toast(label ? `وضعیت سفارش #${toFa(orderId)} به «${label}» تغییر کرد — خریدار همان لحظه در «سفارش‌های من» می‌بیند` : "وضعیت تغییر نکرد", label ? "success" : "info");
  }

  return (
    <div className="space-y-5" data-orders-version={version}>
      <h1 className="font-display text-xl font-black text-ink">سفارش‌ها</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === key ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink hover:border-ink"}`}>{FILTER_FA[key]}</button>
        ))}
      </div>

      {list.length === 0 && <div className="card-surface p-10 text-center text-sm text-ink-muted">سفارشی با این وضعیت نیست.</div>}

      <div className="space-y-3">
        {list.map(({ order, total, fromBuyer }) => {
          const open = expanded === order.id;
          return (
            <div key={order.id} className="card-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setExpanded(open ? null : order.id)} className="flex items-center gap-2 text-right">
                  <ChevronLeft size={16} className={`text-ink-muted transition ${open ? "-rotate-90" : ""}`} />
                  <span className="font-bold text-ink">#{toFa(order.id)}</span>
                  <Badge tone={TONE[order.status]}>{LABEL[order.status]}</Badge>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">{fromBuyer && <span className="ml-1 rounded bg-terracotta/10 px-1.5 py-0.5 text-2xs font-bold text-terracotta-deep">سفارش خریدار</span>}{order.customer} · {order.date} · {toFa(order.lines.reduce((n, l) => n + l.qty, 0))} کالا</span>
                  <span className="font-bold text-ink">{toFa(formatPrice(total))} ت</span>
                </div>
              </div>

              {open && (
                <div className="mt-3 space-y-2 border-t border-clay/40 pt-3">
                  {order.lines.map((line) => {
                    const product = getProductById(line.productId);
                    return (
                      <div key={line.productId} className="flex items-center justify-between rounded-xl border border-clay/30 bg-ivory-2/60 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {product && <img width="36" height="36" src={product.images[0]} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                          <span className="font-medium text-ink">{product?.name ?? "محصول حذف‌شده"}</span>
                        </div>
                        <span className="text-xs text-ink-muted">{toFa(line.qty)} عدد · {toFa(formatPrice(line.price * line.qty))} ت</span>
                      </div>
                    );
                  })}
                  {order.status === "processing" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" onClick={() => advance(order.id)}>ارسال شد</Button>
                    </div>
                  )}
                  {order.status === "shipping" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" onClick={() => advance(order.id)}>تحویل شد</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="flex items-start gap-2 text-2xs leading-6 text-ink-muted">
        <Inbox size={13} className="mt-0.5 shrink-0" />
        <span>
          حالت دمو: سفارش‌هایی که خریداران در همین مرورگر ثبت می‌کنند بلافاصله همین‌جا می‌آیند — <Link href="/account/orders" className="underline">سفارش‌های من (خریدار) ←</Link>
        </span>
      </p>
    </div>
  );
}
