"use client";
// Admin moderation for the customer second-hand marketplace. Ads live in the
// local data layer (backend deferred), so the admin manages the same-browser
// snapshot — same honest scope as the rest of the demo data.
import { useState } from "react";
import { RefreshCcw, Trash2, BadgeCheck } from "lucide-react";
import { Badge, EmptyState, ConfirmDialog, LogoBlock } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { listAllSecondHandAds, setSecondHandAdStatus, removeSecondHandAd, type LocalSecondHandAd } from "@/data/localSecondHandAds";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useDataVersion } from "@/lib/useDataVersion";
import { useUi } from "@/stores/useApp";
import { toFa, formatPrice } from "@/lib/utils";

const STATUS_TONE = { active: "success", sold: "dark" } as const;
const STATUS_LABEL = { active: "فعال", sold: "فروخته شده" } as const;

export default function AdminAdsPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  useDataVersion(); // live refresh when another tab mutates the local data layer
  const [, setBump] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<LocalSecondHandAd | null>(null);
  const [confirmSold, setConfirmSold] = useState<LocalSecondHandAd | null>(null);

  const ads = hydrated ? listAllSecondHandAds() : [];
  const refresh = () => setBump((v) => v + 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">مدیریت آگهی‌های دست دوم</h1>
        <span className="text-xs text-ink-muted">{hydrated ? `${toFa(ads.length)} آگهی` : "…"}</span>
      </div>

      {hydrated && ads.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck size={28} />}
          title="آگهی‌ای ثبت نشده است"
          desc="هر آگهی که کاربران در همین مرورگر ثبت کنند، این‌جا برای مدیریت نمایش داده می‌شود."
        />
      ) : (
        <div className="overflow-hidden card-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
                <th className="p-3 font-medium">آگهی</th>
                <th className="p-3 font-medium">فروشنده</th>
                <th className="p-3 font-medium">قیمت</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <tr key={ad.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <SmartImage src={ad.image} alt={ad.title} className="h-11 w-11 shrink-0 rounded-lg" />
                      <div>
                        <div className="font-medium text-ink">{ad.title}</div>
                        <div className="text-xs text-ink-muted">{ad.categoryLabel} · {ad.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <LogoBlock char={(ad.sellerName ?? "؟")[0]} color="#6b6358" size={32} />
                      <span className="text-ink">{ad.sellerName}</span>
                    </div>
                  </td>
                  <td className="p-3 text-ink">{toFa(formatPrice(ad.price))}</td>
                  <td className="p-3"><Badge tone={STATUS_TONE[ad.status]}>{STATUS_LABEL[ad.status]}</Badge></td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {ad.status === "active" ? (
                        <button
                          onClick={() => setConfirmSold(ad)}
                          className="rounded-lg border border-clay/60 px-3 py-1 text-xs text-ink hover:bg-ivory-2"
                        >
                          فروخته شد
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (setSecondHandAdStatus(ad.id, "active")) {
                              refresh();
                              toast("آگهی دوباره فعال شد");
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg border border-clay/60 px-3 py-1 text-xs text-ink hover:bg-ivory-2"
                        >
                          <RefreshCcw size={12} /> فعال‌سازی
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(ad)}
                        aria-label={`حذف آگهی ${ad.title}`}
                        className="flex items-center gap-1 rounded-lg border border-warning/40 px-3 py-1 text-xs text-warning hover:bg-warning/10"
                      >
                        <Trash2 size={12} /> حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        آگهی‌ها در لایه داده‌ی محلی (همین مرورگر) نگه‌داری می‌شوند؛ مدیریت سراسری با اتصال backend فعال می‌شود.
      </p>

      <ConfirmDialog
        open={Boolean(confirmSold)}
        onClose={() => setConfirmSold(null)}
        onConfirm={() => {
          if (confirmSold && setSecondHandAdStatus(confirmSold.id, "sold")) {
            refresh();
            toast("وضعیت آگهی به «فروخته شد» تغییر کرد");
          }
        }}
        title="فروش این آگهی را تأیید می‌کنی؟"
        description={`وضعیت «${confirmSold?.title ?? ""}» به «فروخته شد» تغییر می‌کند.`}
        confirmLabel="فروخته شد"
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete && removeSecondHandAd(confirmDelete.id)) {
            refresh();
            toast("آگهی حذف شد");
          }
        }}
        title="حذف آگهی"
        description={`«${confirmDelete?.title ?? ""}» برای همیشه حذف می‌شود.`}
        confirmLabel="حذف کن"
        destructive
      />
    </div>
  );
}
