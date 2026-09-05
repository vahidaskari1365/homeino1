// ============================================================
// ORDER TRACKING — one deterministic timeline source.
//
// The account tracking modal, the checkout success page and the vendor panel
// all derive from here, so a status/date shown in one place is exactly what
// the other places show. Steps are per-PARCEL (multi-store orders track each
// shipment separately) and every done step carries a precise date+time.
//
// Date rules:
//  - "ثبت سفارش" = the real order createdAt.
//  - Explicit transitions (vendor panel action, cancel) = the real timestamp
//    recorded in parcel.statusHistory.
//  - Everything else = deterministic offsets from createdAt (6h/26h/74h),
//    identical for every viewer — nothing random to explain to an investor.
// ============================================================
import type { LocalOrder, OrderParcel, OrderStatus } from "@/data/localOrders";
import { parcelStatus, STATUS_LABEL } from "@/data/localOrders";

const OFFSET_HOURS = { confirm: 6, dispatch: 26, deliver: 74 };

/** Persian date + time (تقویم شمسی) — e.g. «۱۴۰۳/۸/۱۵، ۱۴:۳۰». */
export function faDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export interface TrackingStep {
  label: string;
  done: boolean;
  note?: string;
}

function offsetIso(createdAt: string, hours: number): string {
  return new Date(new Date(createdAt).getTime() + hours * 3_600_000).toISOString();
}

function recordedAt(parcel: OrderParcel, label: string): string | undefined {
  const entries = (parcel.statusHistory ?? []).filter((entry) => entry.label === label);
  return entries.length ? entries[entries.length - 1].at : undefined;
}

/** Full 4-step timeline for ONE parcel. */
export function parcelTimeline(order: LocalOrder, parcel: OrderParcel): TrackingStep[] {
  const status: OrderStatus = parcelStatus(order, parcel);
  if (status === "cancelled") {
    const cancelAt = recordedAt(parcel, STATUS_LABEL.cancelled) ?? offsetIso(order.createdAt, 2);
    return [
      { label: "ثبت سفارش", done: true, note: faDateTime(order.createdAt) },
      { label: "لغو سفارش", done: true, note: faDateTime(cancelAt) },
    ];
  }
  const stage = status === "processing" ? 1 : status === "shipping" ? 2 : 3;
  const confirmAt = recordedAt(parcel, STATUS_LABEL.shipping) ?? offsetIso(order.createdAt, OFFSET_HOURS.confirm);
  const dispatchAt = recordedAt(parcel, STATUS_LABEL.shipping) ?? offsetIso(order.createdAt, OFFSET_HOURS.dispatch);
  const deliverAt = recordedAt(parcel, STATUS_LABEL.delivered) ?? offsetIso(order.createdAt, OFFSET_HOURS.deliver);
  return [
    { label: "ثبت سفارش", done: true, note: faDateTime(order.createdAt) },
    {
      label: "تأیید و آماده‌سازی توسط فروشنده",
      done: stage >= 1,
      note: stage >= 2 ? faDateTime(confirmAt) : "در انتظار تأیید فروشنده",
    },
    {
      label: "تحویل به مأمور ارسال",
      done: stage >= 2,
      note: stage >= 2 ? faDateTime(dispatchAt) : "پس از آماده‌سازی",
    },
    {
      label: "تحویل به شما",
      done: stage >= 3,
      note: stage >= 3 ? faDateTime(deliverAt) : "۲ تا ۵ روز کاری",
    },
  ];
}

/** Vendor-panel action labels (same lifecycle as vendorSession). */
export function nextStatusLabel(status: OrderStatus): string | null {
  if (status === "processing") return STATUS_LABEL.shipping;
  if (status === "shipping") return STATUS_LABEL.delivered;
  return null;
}

/** Destination summary line for the modal/success — empty before checkout captures it. */
export function destinationLine(order: LocalOrder): string | null {
  if (!order.address) return null;
  const { city, line } = order.address;
  return `${city} — ${line}`;
}

/** Raw item count of a parcel — callers format it with toFa. */
export function parcelItemsCount(parcel: OrderParcel): number {
  return parcel.lines.reduce((sum, line) => sum + line.qty, 0);
}
