// ============================================================
// VENDOR SESSION — single mock truth for the demo vendor panel.
//
// The vendor area (dashboard / products / orders / store / analytics) reads
// ONLY from here. Everything is derived from the real catalog (st1 = نور
// مبلمان) so numbers always match product pages — nothing is hardcoded on a
// page. Mutations (adding/removing products, advancing order status, editing
// the store profile) are persisted to localStorage, so the vendor's work
// survives a refresh — restored right after hydration via
// useVendorSessionVersion() (src/lib/useVendorSessionVersion.ts).
//
// When the real marketplace backend arrives, swap this module with the API —
// the pages keep working unchanged.
// ============================================================
import { productsByStore, getProductById } from "./products";
import { getStoreById } from "./stores";
import { IMG } from "./media";
import { PLATFORM } from "@/config/platform";
import { readStoredOrders, advanceStoredParcel, parcelStatus, type LocalOrder } from "./localOrders";
import type { Store } from "@/types";

export type VendorOrderStatus = "processing" | "shipping" | "delivered" | "cancelled";

export interface VendorOrderLine {
  productId: string;
  qty: number;
  /** Snapshot price in تومان — kept so history survives catalog edits. */
  price: number;
}

export interface VendorOrder {
  id: string;
  customer: string;
  date: string; // fa-IR date string, sample fixtures are static on purpose
  status: VendorOrderStatus;
  lines: VendorOrderLine[];
}

export interface VendorDraftProduct {
  name: string;
  brand: string;
  categorySlug: string;
  subCategorySlug: string;
  price: number;
  oldPrice?: number;
  stockCount: number;
  description: string;
}

const VENDOR_ID = PLATFORM.vendor.demoStoreId;
const FALLBACK_IMG = IMG.living2;

// ------------------------------------------------------------
// In-memory mutable session (reset on server restart — that is the demo)
// ------------------------------------------------------------
let vendorProducts: ReturnType<typeof productsByStore> = productsByStore(VENDOR_ID);
let profilePatch: {
  name?: string;
  description?: string;
  city?: string;
  phone?: string;
  cover?: string;
  logoChar?: string;
  logoColor?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
} = {};

function seedOrders(): VendorOrder[] {
  // All line items are st1 products — the st1 vendor must never see (or
  // fulfil) another store's items. Ids stay clear of the buyer-side seed
  // range (102456/102401/102389) so the two worlds never double-count.
  const price = (productId: string, fallback: number) => getProductById(productId)?.price ?? fallback;
  return [
    { id: "102457", customer: "نگار م.", date: "۱۴۰۳/۰۸/۱۵", status: "delivered", lines: [{ productId: "p1", qty: 1, price: price("p1", 48500000) }, { productId: "p4", qty: 1, price: price("p4", 63000000) }] },
    { id: "102455", customer: "آرش ر.", date: "۱۴۰۳/۰۸/۱۴", status: "shipping", lines: [{ productId: "p2", qty: 1, price: price("p2", 18900000) }] },
    { id: "102454", customer: "سارا ک.", date: "۱۴۰۳/۰۸/۱۳", status: "processing", lines: [{ productId: "p33", qty: 1, price: price("p33", 62000000) }] },
    { id: "102453", customer: "محمد ت.", date: "۱۴۰۳/۰۸/۱۲", status: "processing", lines: [{ productId: "p2", qty: 1, price: price("p2", 18900000) }] },
    { id: "102451", customer: "نگین ش.", date: "۱۴۰۳/۰۸/۱۰", status: "delivered", lines: [{ productId: "p4", qty: 1, price: price("p4", 63000000) }] },
    { id: "102448", customer: "حسین ق.", date: "۱۴۰۳/۰۸/۰۶", status: "delivered", lines: [{ productId: "p1", qty: 1, price: price("p1", 48500000) }, { productId: "p2", qty: 1, price: price("p2", 18900000) }] },
  ];
}

let orders: VendorOrder[] = seedOrders();

function orderTotal(order: VendorOrder): number {
  return order.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

// ------------------------------------------------------------
// Products — st1 only, in-memory mutations
// ------------------------------------------------------------
export function listVendorProducts(): ReturnType<typeof productsByStore> {
  return [...vendorProducts];
}

export function vendorProductCount(): number {
  return vendorProducts.length;
}

let skuSeq = 0;

// ------------------------------------------------------------
// PERSISTENCE — the vendor's demo session survives refresh.
// Seeds render first (SSR + first paint identical); the persisted snapshot
// is restored inside subscribeVendorSession, which React calls right after
// the hydration commit — so server HTML and the first client paint agree,
// and the persisted state lands one frame later without any mismatch.
// ------------------------------------------------------------
const PERSIST_KEY = "homeino-vendor-session-v1";

interface PersistedVendorSession {
  v: 1;
  products: ReturnType<typeof productsByStore>;
  orders: VendorOrder[];
  profilePatch: typeof profilePatch;
  skuSeq: number;
}

let sessionVersion = 0;
const sessionListeners = new Set<() => void>();
let restoreAttempted = false;

function bumpSession() {
  sessionVersion += 1;
  if (typeof window !== "undefined") {
    try {
      const snapshot: PersistedVendorSession = { v: 1, products: vendorProducts, orders, profilePatch, skuSeq };
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    } catch {
      // quota / private mode — the session keeps working in memory only
    }
  }
  sessionListeners.forEach((listener) => listener());
}

/** Subscribes UI to session changes and performs the one-time restore on the
 *  first subscribe (React fires it right after the hydration commit).
 *  Consumed through useVendorSessionVersion(). */
export function subscribeVendorSession(onChange: () => void): () => void {
  if (!restoreAttempted && typeof window !== "undefined") {
    restoreAttempted = true;
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      const saved = raw ? (JSON.parse(raw) as PersistedVendorSession | null) : null;
      if (saved && saved.v === 1) {
        if (Array.isArray(saved.products)) vendorProducts = saved.products;
        if (Array.isArray(saved.orders)) orders = saved.orders;
        if (saved.profilePatch && typeof saved.profilePatch === "object") profilePatch = saved.profilePatch;
        if (typeof saved.skuSeq === "number") skuSeq = saved.skuSeq;
        sessionVersion += 1;
      }
    } catch {
      // corrupted snapshot — ignore it, the seed session stays live
    }
  }
  sessionListeners.add(onChange);
  return () => sessionListeners.delete(onChange);
}

/** Current session version — 0 during SSR and the hydration render. */
export function vendorSessionVersion(): number {
  return sessionVersion;
}

export function addVendorProduct(draft: VendorDraftProduct) {
  const store = getStoreById(VENDOR_ID);
  const id = `vp-${Date.now().toString(36)}`;
  skuSeq += 1;
  const sku = `NM-${String(skuSeq + vendorProducts.length).padStart(3, "0")}`;
  const product: (typeof vendorProducts)[number] = {
    id,
    sku,
    slug: id,
    name: draft.name.trim(),
    brand: draft.brand.trim() || (store?.name ?? "نور مبلمان"),
    storeId: VENDOR_ID,
    categorySlug: draft.categorySlug,
    subCategorySlug: draft.subCategorySlug,
    styleSlugs: ["modern"],
    price: draft.price,
    oldPrice: draft.oldPrice && draft.oldPrice > draft.price ? draft.oldPrice : undefined,
    currency: "تومان",
    rating: 0,
    reviewsCount: 0,
    purchaseCount: 0,
    images: [FALLBACK_IMG],
    colors: [],
    materials: [],
    description: draft.description.trim() || "توضیحات این محصول به‌زودی تکمیل می‌شود.",
    specs: [],
    inStock: draft.stockCount > 0,
    stockCount: draft.stockCount,
    isNew: true,
    tags: [],
  };
  vendorProducts = [product, ...vendorProducts];
  bumpSession();
  return product;
}

export function updateVendorProduct(id: string, patch: { name?: string; price?: number; stockCount?: number }) {
  vendorProducts = vendorProducts.map((product) =>
    product.id === id
      ? {
          ...product,
          name: patch.name?.trim() || product.name,
          price: patch.price && patch.price > 0 ? patch.price : product.price,
          stockCount: patch.stockCount !== undefined && patch.stockCount >= 0 ? patch.stockCount : product.stockCount,
          inStock: patch.stockCount !== undefined ? patch.stockCount > 0 : product.inStock,
        }
      : product,
  );
  bumpSession();
}

export function removeVendorProduct(id: string) {
  vendorProducts = vendorProducts.filter((product) => product.id !== id);
  bumpSession();
}

// ------------------------------------------------------------
// Orders — derived state + lifecycle + buyer bridge
// ------------------------------------------------------------
export function listVendorOrders(): { order: VendorOrder; total: number; storeName: string }[] {
  return orders.map((order) => ({ order, total: orderTotal(order), storeName: getStoreById(VENDOR_ID)?.name ?? "فروشگاه من" }));
}

export interface VendorOrderRow {
  order: VendorOrder;
  total: number;
  storeName: string;
  /** true = placed by a real buyer in this browser (localStorage), so the
   *  vendor's status changes write straight back into the buyer's tracking. */
  fromBuyer?: boolean;
}

/** Session seeds + buyer-placed orders whose st1 parcel arrives here.
 *  Client-side only — server render simply gets the seeds. */
export function listVendorOrdersWithBuyers(): VendorOrderRow[] {
  const rows: VendorOrderRow[] = listVendorOrders().map((row) => ({ ...row }));
  if (typeof window === "undefined") return rows;
  let buyerOrders: LocalOrder[] = [];
  try {
    buyerOrders = readStoredOrders();
  } catch {
    buyerOrders = [];
  }
  for (const buyerOrder of buyerOrders) {
    for (const parcel of buyerOrder.parcels) {
      if (parcel.storeId !== VENDOR_ID) continue;
      const status = parcelStatus(buyerOrder, parcel);
      rows.push({
        order: {
          id: buyerOrder.id,
          customer: buyerOrder.address?.fullName || "خریدار Homeino",
          date: buyerOrder.faDate,
          status,
          lines: parcel.lines.map((line) => ({ productId: line.productId, qty: line.qty, price: line.price })),
        },
        total: parcel.lines.reduce((sum, line) => sum + line.price * line.qty, 0),
        storeName: getStoreById(VENDOR_ID)?.name ?? "فروشگاه من",
        fromBuyer: true,
      });
    }
  }
  return rows;
}

export function nextOrderStatus(status: VendorOrderStatus): VendorOrderStatus {
  if (status === "processing") return "shipping";
  if (status === "shipping") return "delivered";
  return status;
}

export function advanceVendorOrder(id: string): VendorOrderStatus | null {
  const target = orders.find((order) => order.id === id);
  if (target) {
    const next = nextOrderStatus(target.status);
    if (next !== target.status) {
      orders = orders.map((order) => (order.id === id ? { ...order, status: next } : order));
      bumpSession();
    }
    return next;
  }
  // Not a seed row → it is a buyer-placed order in this browser. Advance the
  // st1 parcel in localStorage so the buyer's tracking updates instantly.
  return advanceStoredParcel(id, VENDOR_ID);
}

export function vendorStats(includeBuyers = false) {
  // includeBuyers=true merges buyer-placed orders (localStorage) into the
  // sales math — call it only after hydration (client) to avoid SSR drift.
  const allOrders: VendorOrder[] = includeBuyers
    ? [
        ...orders,
        ...listVendorOrdersWithBuyers()
          .filter((row) => row.fromBuyer && !orders.some((seed) => seed.id === row.order.id))
          .map((row) => row.order),
      ]
    : orders;
  const active = allOrders.filter((order) => order.status !== "cancelled");
  const delivered = allOrders.filter((order) => order.status === "delivered");
  const monthSales = active.reduce((sum, order) => sum + orderTotal(order), 0);
  const pendingOrders = active.filter((order) => order.status === "processing").length;
  return {
    monthSales,
    ordersCount: active.length,
    deliveredCount: delivered.length,
    processingCount: pendingOrders,
    shippingCount: active.filter((order) => order.status === "shipping").length,
    // Settlement math — percentages are the config constant, never a page literal.
    commissionRate: PLATFORM.vendor.commissionRatePercent,
    grossSales: delivered.reduce((sum, order) => sum + orderTotal(order), 0),
    platformCommission: Math.round(delivered.reduce((sum, order) => sum + orderTotal(order), 0) * (PLATFORM.vendor.commissionRatePercent / 100)),
    settlementBalance: Math.round(delivered.reduce((sum, order) => sum + orderTotal(order), 0) * (1 - PLATFORM.vendor.commissionRatePercent / 100)),
    productCount: vendorProducts.length,
    activeProductCount: vendorProducts.filter((product) => product.inStock).length,
  };
}

// ------------------------------------------------------------
// Store profile — in-memory edits
// ------------------------------------------------------------
export function vendorStoreProfile() {
  const base = getStoreById(VENDOR_ID);
  return {
    id: VENDOR_ID,
    name: profilePatch.name ?? base?.name ?? "فروشگاه من",
    description: profilePatch.description ?? base?.description ?? "",
    city: profilePatch.city ?? base?.city ?? "",
    phone: profilePatch.phone ?? "۰۲۱-۹۱۰۰۸۸۲۲",
    cover: profilePatch.cover ?? base?.cover ?? FALLBACK_IMG,
    logoChar: profilePatch.logoChar ?? base?.logo ?? "ن",
    logoColor: profilePatch.logoColor ?? base?.logoColor ?? "#c2703f",
    badges: base?.badges ?? [],
    responseTime: base?.responseTime ?? "",
    shippingPolicy: profilePatch.shippingPolicy ?? base?.shippingPolicy ?? "",
    returnPolicy: profilePatch.returnPolicy ?? base?.returnPolicy ?? "",
  };
}

export function updateVendorStoreProfile(patch: {
  name?: string;
  description?: string;
  city?: string;
  phone?: string;
  cover?: string;
  logoChar?: string;
  logoColor?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
}) {
  const next = { ...profilePatch };
  if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim();
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.city !== undefined && patch.city.trim()) next.city = patch.city.trim();
  if (patch.phone !== undefined && patch.phone.trim()) next.phone = patch.phone.trim();
  // An empty cover would break the public page image — fall back to the
  // fixture cover instead of storing "".
  if (patch.cover !== undefined && patch.cover.trim()) next.cover = patch.cover.trim();
  if (patch.logoChar !== undefined && patch.logoChar.trim()) next.logoChar = patch.logoChar.trim();
  if (patch.logoColor !== undefined && patch.logoColor.trim()) next.logoColor = patch.logoColor.trim();
  if (patch.shippingPolicy !== undefined) next.shippingPolicy = patch.shippingPolicy;
  if (patch.returnPolicy !== undefined) next.returnPolicy = patch.returnPolicy;
  profilePatch = next;
  bumpSession();
  return vendorStoreProfile();
}

// ------------------------------------------------------------
// PUBLIC MIRROR — vendor edits/products surface on the public site
// ------------------------------------------------------------

/** The public store record with the vendor's session edits applied. */
export function resolvePublicStore(store: Store): Store {
  if (store.id !== VENDOR_ID) return store;
  return {
    ...store,
    name: profilePatch.name ?? store.name,
    description: profilePatch.description ?? store.description,
    city: profilePatch.city ?? store.city,
    cover: profilePatch.cover ?? store.cover,
    logo: profilePatch.logoChar ?? store.logo,
    logoColor: profilePatch.logoColor ?? store.logoColor,
    shippingPolicy: profilePatch.shippingPolicy ?? store.shippingPolicy,
    returnPolicy: profilePatch.returnPolicy ?? store.returnPolicy,
  };
}

/** Store products including the vendor's session-added products (st1). */
export function allStoreProductsPublic(storeId: string): ReturnType<typeof productsByStore> {
  const base = productsByStore(storeId);
  if (storeId !== VENDOR_ID) return base;
  const baseIds = new Set(base.map((product) => product.id));
  return [...vendorProducts.filter((product) => !baseIds.has(product.id)), ...base];
}

/** Resolve a vendor-added product by id or slug (for /products/[slug]). */
export function findVendorProductPublic(idOrSlug: string): ReturnType<typeof productsByStore>[number] | undefined {
  return vendorProducts.find((product) => product.id === idOrSlug || product.slug === idOrSlug);
}
