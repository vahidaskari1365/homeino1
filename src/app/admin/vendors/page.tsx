"use client";
import { useState } from "react";
import { Badge, LogoBlock, Button } from "@/components/ui/primitives";
import { stores } from "@/data/stores";
import { productsByStore } from "@/data/products";
import { listPendingVendors, decideVendorApplication } from "@/data/vendorRegistrations";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";

export default function AdminVendorsPage() {
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
                  <div className="flex items-center gap-2"><LogoBlock char={app.storeName[0] ?? "ف"} color="#b8915a" size={36} />
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
