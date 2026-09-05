// ============================================================
// LOCAL ORDER HISTORY — buyer-side demo persistence.
//
// Because the real checkout runs without a database, every placed order is
// persisted to localStorage (this module is the single source of truth for
// /account/orders). Seed rows give the demo an instant believable history;
// placed orders append on top. Cancel/track actions mutate the same store.
// Swap for the real orders API when the backend lands — pages keep working.
//
// TRACKING PRECISION: every parcel carries its own status + status history,
// so the vendor panel (st1) can advance the parcel it fulfils while other
// stores' parcels progress deterministically with the elapsed time. All
// timeline dates come from src/lib/orderTracking.ts — one source, no drift.
// ============================================================
import type { CartItem } from "@/types";
import { getProductById } from "./products";
import { getStoreById } from "./stores";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { uid } from "@/lib/utils";
import { PLATFORM } from "@/config/platform";

export type OrderStatus = "processing" | "shipping" | "delivered" | "cancelled";

export interface OrderParcelLine {
  productId: string;
  name: string;
  image: string;
  qty: number;
  /** unit price at purchase time (تومان) */
  price: number;
}

export interface OrderParcel {
  storeId: string;
  storeName: string;
  /** 0 = ارسال رایگان */
  shippingCost: number;
  lines: OrderParcelLine[];
  /** Parcel-level status override (set by the vendor panel or cancel).
   *  Missing = derive deterministically from elapsed time. */
  status?: OrderStatus;
  /** Real transition log — rendered verbatim in the tracking timeline. */
  statusHistory?: { label: string; at: string }[];
}

export interface OrderAddress {
  fullName: string;
  phone: string;
  city: string;
  line: string;
  postalCode?: string;
}

export interface LocalOrder {
  id: string;
  createdAt: string; // ISO
  faDate: string;
  status: OrderStatus;
  parcels: OrderParcel[];
  total: number;
  itemsCount: number;
  /** Delivery destination captured at checkout (demo — no DB yet). */
  address?: OrderAddress;
  /** "online" | "wallet" | "cod" */
  payMethod?: string;
  /** "post" | "express" */
  shippingMethod?: string;
}

const KEY = "homeino-orders";
export const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "در حال پردازش",
  shipping: "در حال ارسال",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
};

export const PAY_LABEL: Record<string, string> = {
  online: "پرداخت آنلاین",
  wallet: "کیف پول Homeino",
  cod: "پرداخت در محل",
};
export const SHIPPING_LABEL: Record<string, string> = {
  post: "پست عادی",
  express: "پیک سریع",
};

function read(): LocalOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalOrder[]) : [];
  } catch {
    return [];
  }
}

function write(orders: LocalOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders));
  } catch {
    // storage full / private mode — demo keeps working in memory only
  }
}

/** Raw stored orders only (no seeds) — shared with the vendor panel bridge. */
export function readStoredOrders(): LocalOrder[] {
  return read();
}

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

/** Deterministic parcel status when no one has overridden it: the "other
 *  stores" of the demo fulfil on their own schedule (6h/26h/74h), matching
 *  the offsets shown in the tracking timeline. */
export function timeBasedStatus(createdAt: string, now = Date.now()): OrderStatus {
  const hours = (now - new Date(createdAt).getTime()) / 3_600_000;
  if (hours >= 74) return "delivered";
  if (hours >= 26) return "shipping";
  return "processing";
}

/** The status a parcel should display: explicit override wins (vendor panel
 *  action / cancel), otherwise the deterministic time-based progression. */
export function parcelStatus(order: LocalOrder, parcel: OrderParcel): OrderStatus {
  if (order.status === "cancelled") return "cancelled";
  return parcel.status ?? timeBasedStatus(order.createdAt);
}

const STAGE: Record<OrderStatus, number> = { cancelled: 0, processing: 1, shipping: 2, delivered: 3 };

/** Order-level badge status = the least-advanced parcel (multi-store honest). */
export function orderDisplayStatus(order: LocalOrder): OrderStatus {
  if (order.status === "cancelled") return "cancelled";
  return order.parcels.reduce<OrderStatus>(
    (min, parcel) => (STAGE[parcelStatus(order, parcel)] < STAGE[min] ? parcelStatus(order, parcel) : min),
    "delivered",
  );
}

/** Advance only the st1 (demo vendor) parcel of a buyer-placed order, then
 *  recompute the order status. Called from the vendor panel. */
export function advanceStoredParcel(orderId: string, storeId: string): OrderStatus | null {
  const orders = read();
  const target = orders.find((order) => order.id === orderId);
  if (!target) return null;
  if (target.status === "cancelled" || target.status === "delivered") return target.status;
  let next: OrderStatus | null = null;
  const updated: LocalOrder = {
    ...target,
    parcels: target.parcels.map((parcel) => {
      if (parcel.storeId !== storeId) return parcel;
      next = parcel.status === "processing" ? "shipping" : "delivered";
      return {
        ...parcel,
        status: next,
        statusHistory: [...(parcel.statusHistory ?? []), { label: STATUS_LABEL[next], at: new Date().toISOString() }],
      };
    }),
  };
  if (!next) return target.status;
  const stages = updated.parcels.map((parcel) => STAGE[parcelStatus(updated, parcel)]);
  const minStage = Math.min(...stages);
  updated.status = (Object.keys(STAGE) as OrderStatus[]).find((s) => STAGE[s] === minStage) ?? updated.status;
  write(orders.map((order) => (order.id === orderId ? updated : order)));
  return next;
}

function seedOrders(): LocalOrder[] {
  // Static ids/statuses intentionally match the old mock list — but item names
  // are resolved from the real catalog at read time, and each store ships in
  // its own parcel (same rule as groupCartParcels).
  const demo = (
    id: string,
    daysAgo: number,
    status: OrderStatus,
    parcels: { storeId: string; lines: { productId: string; qty: number }[] }[],
  ): LocalOrder => {
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const builtParcels: OrderParcel[] = parcels.map((parcel) => {
      const store = getStoreById(parcel.storeId);
      const lines = parcel.lines.map((line) => {
        const product = getProductById(line.productId);
        const name = product?.name ?? "محصول حذف‌شده";
        const image = product?.images[0] ?? "";
        const price = product?.price ?? 0;
        return { productId: line.productId, name, image, qty: line.qty, price };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      const threshold = PLATFORM.policies.freeShippingThreshold;
      // Sample history — history entries follow the same offsets the
      // tracking timeline renders (6h/26h/74h), so dates stay consistent.
      const at = (hours: number) => new Date(new Date(createdAt).getTime() + hours * 3_600_000).toISOString();
      const history: { label: string; at: string }[] = [{ label: "ثبت سفارش", at: createdAt }];
      if (status !== "processing") history.push({ label: STATUS_LABEL.shipping, at: at(26) });
      if (status === "delivered") history.push({ label: STATUS_LABEL.delivered, at: at(74) });
      return {
        storeId: parcel.storeId,
        storeName: store?.name ?? "فروشگاه",
        shippingCost: subtotal >= threshold ? 0 : 120_000,
        lines,
        status,
        statusHistory: history,
      };
    });
    const total = builtParcels.reduce((sum, parcel) => sum + parcel.shippingCost + parcel.lines.reduce((s, l) => s + l.price * l.qty, 0), 0);
    const itemsCount = builtParcels.reduce((sum, parcel) => sum + parcel.lines.reduce((s, l) => s + l.qty, 0), 0);
    return { id, createdAt, faDate: faDate(createdAt), status, parcels: builtParcels, total, itemsCount };
  };

  return [
    // st1 (فروشگاه دمو) و st5 هر کدام مرسولهٔ خودشان — مثل گروه‌بندی واقعی checkout
    demo("102456", 21, "delivered", [{ storeId: "st1", lines: [{ productId: "p1", qty: 1 }] }, { storeId: "st5", lines: [{ productId: "p15", qty: 1 }] }]),
    demo("102401", 34, "shipping", [{ storeId: "st3", lines: [{ productId: "p9", qty: 1 }] }]),
    demo("102389", 47, "processing", [{ storeId: "st4", lines: [{ productId: "p12", qty: 1 }] }]),
  ];
}

export function listLocalOrders(): LocalOrder[] {
  const stored = read();
  const storedIds = new Set(stored.map((order) => order.id));
  const seeds = seedOrders().filter((order) => !storedIds.has(order.id));
  return [...stored, ...seeds].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cancelLocalOrder(orderId: string): LocalOrder | null {
  const orders = read();
  const target = orders.find((order) => order.id === orderId);
  if (target) {
    if (target.status === "cancelled" || target.status === "delivered") return null;
    const now = new Date().toISOString();
    const next: LocalOrder = {
      ...target,
      status: "cancelled",
      parcels: target.parcels.map((parcel) => ({
        ...parcel,
        status: "cancelled",
        statusHistory: [...(parcel.statusHistory ?? []), { label: STATUS_LABEL.cancelled, at: now }],
      })),
    };
    write(orders.map((order) => (order.id === orderId ? next : order)));
    return next;
  }
  // Seed orders live only in code — materialize a cancelled copy so the
  // cancel action always produces a real, persisted result (write-through).
  const seed = seedOrders().find((order) => order.id === orderId);
  if (seed && (seed.status === "processing" || seed.status === "shipping")) {
    const now = new Date().toISOString();
    const cancelled: LocalOrder = {
      ...seed,
      status: "cancelled",
      parcels: seed.parcels.map((parcel) => ({
        ...parcel,
        status: "cancelled",
        statusHistory: [...(parcel.statusHistory ?? []), { label: STATUS_LABEL.cancelled, at: now }],
      })),
    };
    write([cancelled, ...orders].slice(0, 40));
    return cancelled;
  }
  return null;
}

/** Session-level record of ids already handed out — keeps ids collision-free
 *  within a running module even when localStorage cannot persist (private mode). */
const usedOrderIds = new Set<string>();

/** Generate a unique order id without colliding with existing rows — both the
 *  placed orders in storage and the static seed orders are checked first; the
 *  uid() fallback keeps ids unique even when the small numeric demo range
 *  becomes crowded (or storage is unavailable in tests). */
function nextOrderId(): string {
  if (usedOrderIds.size === 0) {
    for (const order of [...read(), ...seedOrders()]) usedOrderIds.add(order.id);
  }
  let id = `${Math.floor(102500 + Math.random() * 500)}`;
  if (usedOrderIds.has(id)) id = uid();
  while (usedOrderIds.has(id)) id = uid();
  usedOrderIds.add(id);
  return id;
}

export interface PlaceOrderMeta {
  address?: OrderAddress;
  payMethod?: string;
  shippingMethod?: string;
}

export function placeLocalOrder(items: CartItem[], express = false, meta: PlaceOrderMeta = {}): LocalOrder {
  const now = new Date().toISOString();
  const id = nextOrderId();
  // Shipping cost per parcel must EXACTLY match checkout: derive it from the
  // same resolveCartLines + groupCartParcels pipeline so success/account totals
  // never drift from the checkout summary.
  const parcels: OrderParcel[] = groupCartParcels(resolveCartLines(items), express).map((parcel) => ({
    storeId: parcel.storeId,
    storeName: parcel.storeName,
    shippingCost: parcel.shippingCost,
    status: "processing",
    statusHistory: [{ label: "ثبت سفارش", at: now }],
    lines: parcel.lines.map((line) => ({
      productId: line.product.id,
      name: line.product.name,
      image: line.product.images[0],
      qty: line.item.qty,
      price: line.unitPrice,
    })),
  }));
  const itemsCount = parcels.reduce((sum, parcel) => sum + parcel.lines.reduce((s, l) => s + l.qty, 0), 0);
  const total = parcels.reduce((sum, parcel) => sum + parcel.shippingCost + parcel.lines.reduce((s, l) => s + l.price * l.qty, 0), 0);
  const order: LocalOrder = { id, createdAt: now, faDate: faDate(now), status: "processing", parcels, total, itemsCount, ...meta };

  const orders = read();
  write([order, ...orders].slice(0, 40));
  return order;
}
