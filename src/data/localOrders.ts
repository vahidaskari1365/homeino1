// ============================================================
// LOCAL ORDER HISTORY — buyer-side demo persistence.
//
// Because the real checkout runs without a database, every placed order is
// persisted to localStorage (this module is the single source of truth for
// /account/orders). Seed rows give the demo an instant believable history;
// placed orders append on top. Cancel/track actions mutate the same store.
// Swap for the real orders API when the backend lands — pages keep working.
// ============================================================
import type { CartItem } from "@/types";
import { getProductById } from "./products";
import { getStoreById } from "./stores";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { uid } from "@/lib/utils";

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
}

export interface LocalOrder {
  id: string;
  createdAt: string; // ISO
  faDate: string;
  status: OrderStatus;
  parcels: OrderParcel[];
  total: number;
  itemsCount: number;
}

const KEY = "homeino-orders";
export const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "در حال پردازش",
  shipping: "در حال ارسال",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
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

export function listLocalOrders(): LocalOrder[] {
  const seeds = seedOrders();
  return [...read(), ...seeds].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

function seedOrders(): LocalOrder[] {
  // Static ids/statuses intentionally match the old mock list — but item names
  // are resolved from the real catalog at read time.
  const demo = (
    id: string,
    daysAgo: number,
    status: OrderStatus,
    parcels: { storeId: string; lines: { productId: string; qty: number }[] }[],
  ): LocalOrder => {
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const builtParcels = parcels.map((parcel) => {
      const store = getStoreById(parcel.storeId);
      const lines = parcel.lines.map((line) => {
        const product = getProductById(line.productId);
        const name = product?.name ?? "محصول حذف‌شده";
        const image = product?.images[0] ?? "";
        const price = product?.price ?? 0;
        return { productId: line.productId, name, image, qty: line.qty, price };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      return {
        storeId: parcel.storeId,
        storeName: store?.name ?? "فروشگاه",
        shippingCost: subtotal >= 5_000_000 ? 0 : 120_000,
        lines,
      };
    });
    const total = builtParcels.reduce((sum, parcel) => sum + parcel.shippingCost + parcel.lines.reduce((s, l) => s + l.price * l.qty, 0), 0);
    const itemsCount = builtParcels.reduce((sum, parcel) => sum + parcel.lines.reduce((s, l) => s + l.qty, 0), 0);
    return { id, createdAt, faDate: faDate(createdAt), status, parcels: builtParcels, total, itemsCount };
  };

  return [
    demo("102456", 21, "delivered", [{ storeId: "st1", lines: [{ productId: "p1", qty: 1 }, { productId: "p15", qty: 1 }] }]),
    demo("102401", 34, "shipping", [{ storeId: "st3", lines: [{ productId: "p9", qty: 1 }] }]),
    demo("102389", 47, "processing", [{ storeId: "st4", lines: [{ productId: "p12", qty: 1 }] }]),
  ];
}

export function cancelLocalOrder(orderId: string): LocalOrder | null {
  const orders = read();
  const target = orders.find((order) => order.id === orderId);
  if (!target) return null;
  if (target.status === "cancelled" || target.status === "delivered") return null;
  const next = { ...target, status: "cancelled" as OrderStatus };
  write(orders.map((order) => (order.id === orderId ? next : order)));
  return next;
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

export function placeLocalOrder(items: CartItem[], express = false): LocalOrder {
  const now = new Date().toISOString();
  const id = nextOrderId();
  // Shipping cost per parcel must EXACTLY match checkout: derive it from the
  // same resolveCartLines + groupCartParcels pipeline so success/account totals
  // never drift from the checkout summary.
  const parcels: OrderParcel[] = groupCartParcels(resolveCartLines(items), express).map((parcel) => ({
    storeId: parcel.storeId,
    storeName: parcel.storeName,
    shippingCost: parcel.shippingCost,
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
  const order: LocalOrder = { id, createdAt: now, faDate: faDate(now), status: "processing", parcels, total, itemsCount };

  const orders = read();
  write([order, ...orders].slice(0, 40));
  return order;
}

/** Demo "tracking": 4 static steps with honest done state per status. */
export function trackLocalOrder(order: LocalOrder): { label: string; done: boolean; note?: string }[] {
  const cancelled = order.status === "cancelled";
  const atLeast = (step: number) => {
    if (cancelled) return step <= 1;
    if (order.status === "processing") return step <= 1;
    if (order.status === "shipping") return step <= 2;
    return step <= 4;
  };
  return [
    { label: "ثبت سفارش", done: true, note: order.faDate },
    { label: "تأیید و آماده‌سازی توسط فروشنده", done: atLeast(2), note: cancelled ? "لغو شد" : order.status === "processing" ? "در انتظار" : order.status === "shipping" ? "انجام شد" : order.faDate },
    { label: "تحویل به مامور ارسال", done: atLeast(3), note: order.status === "shipping" ? "در جریان است" : "" },
    { label: "تحویل به شما", done: atLeast(4), note: order.status === "delivered" ? "تکمیل شد" : "" },
  ];
}
