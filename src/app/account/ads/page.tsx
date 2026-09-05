"use client";
// «آگهی‌های من» — the customer's own second-hand listings.
import { useState } from "react";
import Link from "next/link";
import { Tag, Plus, Trash2, BadgeCheck, RefreshCcw } from "lucide-react";
import { Button, EmptyState, Badge, ConfirmDialog } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { listMySecondHandAds, markSecondHandAdSold, removeSecondHandAd, type LocalSecondHandAd } from "@/data/localSecondHandAds";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useUi } from "@/stores/useApp";
import { toFa, formatPrice } from "@/lib/utils";

export default function MyAdsPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const [version, setVersion] = useState(0);
  const [confirmSold, setConfirmSold] = useState<LocalSecondHandAd | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LocalSecondHandAd | null>(null);
  const ads = hydrated ? listMySecondHandAds() : [];

  return (
    <div className="space-y-5" data-ads-version={version}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">آگهی‌های من</h1>
          <p className="text-sm text-ink-muted">آگهی‌های دسته دومی که خودت ثبت کرده‌ای — همین‌جا مدیریتشان کن.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/second-hand"><Button variant="outline">مشاهده بازار دسته دوم</Button></Link>
          <Link href="/account/ads/new"><Button><Plus size={16} /> آگهی جدید</Button></Link>
        </div>
      </div>

      {ads.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {ads.map((ad) => (
            <div key={ad.id} className="card-surface flex gap-4 p-4">
              <SmartImage src={ad.image} alt={ad.title} className="h-24 w-24 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-bold text-ink">{ad.title}</h3>
                    <p className="text-xs text-ink-muted">{ad.categoryLabel} · {ad.city} · {ad.createdAt}</p>
                  </div>
                  <Badge tone={ad.status === "sold" ? "dark" : "success"}>{ad.status === "sold" ? "فروخته شد" : "فعال"}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-ink-muted">{ad.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="font-display text-sm font-black text-ink">{toFa(formatPrice(ad.price))} تومان</span>
                  <div className="flex gap-1.5">
                    {ad.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmSold(ad)}><BadgeCheck size={14} /> فروخته شد</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(ad)}><Trash2 size={14} /> حذف</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Tag size={28} />}
          title="هنوز آگهی‌ای نداری"
          desc="وسایل دسته دومی که لازم نداری را آگهی کن — با همان دسته‌بندی‌های خود سایت."
          action={<Link href="/account/ads/new"><Button><Plus size={16} /> ثبت اولین آگهی</Button></Link>}
        />
      )}

      {ads.length > 0 && (
        <p className="flex items-center gap-2 text-[11px] text-ink-muted"><RefreshCcw size={12} /> آگهی‌ها در همین مرورگر ذخیره می‌شوند و در صفحهٔ عمومی «دسته دوم» با برچسب «آگهی تو» نمایش داده می‌شوند.</p>
      )}

      <ConfirmDialog
        open={Boolean(confirmSold)}
        onClose={() => setConfirmSold(null)}
        onConfirm={() => {
          if (confirmSold && markSecondHandAdSold(confirmSold.id)) {
            setVersion((v) => v + 1);
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
            setVersion((v) => v + 1);
            toast("آگهی حذف شد");
          }
        }}
        title="حذف آگهی"
        description={`«${confirmDelete?.title ?? ""}» برای همیشه از آگهی‌های تو حذف می‌شود.`}
        confirmLabel="حذف کن"
        destructive
      />
    </div>
  );
}
