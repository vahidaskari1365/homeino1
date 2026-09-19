"use client";
// ============================================================
// صندوق پیام فروشنده — /vendor/notifications (Task 59)
//
// «جایی که به فروشنده پیغام می‌رود»: فروش جدید، وضعیت تسویه، پکیج و
// پیام‌های پلتفرم — همهٔ پیام‌های واقعی سرور. هر پیام وضعیت SMS خودش را
// شفاف نشان می‌دهد (sent/skipped/…): تا مالک پنل پیامک نخریده،
// «در انتظار فعال‌سازی پنل پیامک» صادقانه نمایش داده می‌شود — هیچ وضعیت
// فیک «ارسال شد» وجود ندارد.
//
// الگوی صداقت ریپو: API واقعی اول؛ سقوط به پیام صادقانه فقط روی
// 503+DEMO_MODE یا قطع شبکه؛ خطای واقعی = پیام صادقانه.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Info, LogIn, ShoppingBag, Wallet, Crown, MessageSquare, RefreshCw } from "lucide-react";
import { Button, Badge, Spinner } from "@/components/ui/primitives";
import { toFa, cn } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import {
  fetchVendorNotifications,
  markVendorNotificationsRead,
  faDate,
  isDemoFallback,
  type VendorNotificationRow,
} from "@/lib/vendorClient";

const KIND_META: Record<string, { label: string; icon: typeof Bell; tone: "gold" | "success" | "accent" | "neutral" }> = {
  order_sold: { label: "فروش", icon: ShoppingBag, tone: "success" },
  payout: { label: "تسویه", icon: Wallet, tone: "accent" },
  package: { label: "پکیج", icon: Crown, tone: "gold" },
  platform_message: { label: "پیام هومینو", icon: MessageSquare, tone: "neutral" },
};

const SMS_LABEL: Record<string, string> = {
  sent: "پیامک ارسال شد",
  failed: "پیامک ناموفق",
  skipped: "پیامک: در انتظار فعال‌سازی پنل پیامک",
  no_phone: "پیامک: شمارهٔ موبایل ثبت نشده",
  pending: "پیامک: در صف ارسال",
};

export default function VendorNotificationsPage() {
  const { toast } = useUi();
  const [loading, setLoading] = useState(true);
  const [honest, setHonest] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<VendorNotificationRow[]>([]);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetchVendorNotifications(50);
    if (res.ok) {
      setItems(res.data.items);
      setUnread(res.data.unread);
      setHonest(null);
    } else if (isDemoFallback(res)) {
      setHonest("این بخش با اتصال واقعی سرور فعال می‌شود — در حالت دمو پیام واقعی وجود ندارد.");
    } else if (res.status === 401) {
      setAuthNeeded(true);
    } else {
      setHonest(res.message ?? "دریافت پیام‌ها ناموفق بود");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    // deferred one microtask — setState sync داخل effect body ممنوع (الگوی ریپو)
    void (async () => {
      await Promise.resolve();
      if (alive) await load();
    })();
    return () => { alive = false; };
  }, [load]);

  async function markAll() {
    if (marking) return;
    setMarking(true);
    const res = await markVendorNotificationsRead({ all: true });
    setMarking(false);
    if (res.ok) {
      toast(res.data.updated > 0 ? `${toFa(res.data.updated)} پیام خوانده شد` : "پیام خوانده‌نشده‌ای نبود", "success");
      void load(true);
    } else {
      toast(res.message ?? "علامت‌گذاری ناموفق بود", "error");
    }
  }

  async function markOne(id: string) {
    const res = await markVendorNotificationsRead({ ids: [id] });
    if (res.ok) void load(true);
  }

  if (loading) {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت پیام‌ها…</div>;
  }

  if (authNeeded) {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">صندوق پیام فروشگاه فقط با حساب کاربریِ متصل به فروشگاه شما در دسترس است.</p>
        <a href="/login?next=%2Fvendor%2Fnotifications" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold"><Bell size={19} /></span>
          <div>
            <h1 className="font-display text-xl font-black text-ink">اطلاع‌رسانی‌ها</h1>
            <p className="text-xs text-ink-muted">
              {unread > 0 ? `${toFa(unread)} پیام خوانده‌نشده — فروش جدید، تسویه و پکیج اینجا می‌آید.` : "همهٔ پیام‌های فروشگاه شما — فروش جدید، تسویه و پکیج."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load(true)}><RefreshCw size={14} /> بروزرسانی</Button>
          <Button variant="ghost" disabled={marking || unread === 0} onClick={() => void markAll()}>
            <CheckCheck size={14} /> همه خواندم
          </Button>
        </div>
      </div>

      {honest && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3 text-xs leading-6 text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-gold" />
          <span>{honest}</span>
        </p>
      )}

      {!honest && items.length === 0 && (
        <div className="card-surface p-10 text-center">
          <BellOff size={26} className="mx-auto text-ink-muted" />
          <h2 className="mt-3 font-display text-base font-bold text-ink">هنوز پیامی ندارید</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">
            با اولین فروش، وضعیت تسویه یا فعال‌سازی پکیج، پیام‌ها همین‌جا (و پس از فعال‌سازی پنل پیامک، روی موبایل شما) می‌آیند.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((n) => {
          const meta = KIND_META[n.kind] ?? KIND_META.platform_message;
          const Icon = meta.icon;
          const inner = (
            <div
              className={cn(
                "card-surface flex items-start gap-3 p-4 transition-colors",
                !n.readAt && "border-gold/40 bg-gold/5",
              )}
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ivory-2 text-ink-muted"><Icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-gold" aria-label="خوانده‌نشده" />}
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                {n.body && <p className="mt-1 text-xs leading-6 text-ink-muted">{n.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
                  <span>{faDate(n.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span className={cn(n.smsStatus === "sent" && "text-success", n.smsStatus === "failed" && "text-danger")}>
                    {SMS_LABEL[n.smsStatus] ?? n.smsStatus}
                  </span>
                </div>
              </div>
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} onClick={() => { if (!n.readAt) void markOne(n.id); }} className="block">
              {inner}
            </Link>
          ) : (
            <button key={n.id} type="button" onClick={() => { if (!n.readAt) void markOne(n.id); }} className="block w-full text-right">
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
