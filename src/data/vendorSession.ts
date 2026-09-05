// ============================================================
// VENDOR SESSION — single mock truth for the demo vendor panel.
//
// The vendor area (dashboard / products / orders / store / analytics) reads
// ONLY from here. Everything is derived from the real catalog (st1 = نور
// مبلمان) so numbers always match product pages — nothing is hardcoded on a
// page. Mutations live in process memory (demo): adding/removing products,
// advancing order status, editing the store profile.
//
// When the real marketplace backend arrives, swap this module with the API —
// the pages keep working unchanged.
// ============================================================
import { productsByStore, getProductById } from "./products";
import { getStoreById } from "./stores";
import { IMG } from "./media";
import { PLATFORM } from "@/config/platform";

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
  const price = (productId: string, fallback: number) => getProductById(productId)?.price ?? fallback;
  return [
    { id: "102456", customer: "نگار م.", date: "۱۴۰۳/۰۸/۱۵", status: "delivered", lines: [{ productId: "p1", qty: 1, price: price("p1", 48500000) }, { productId: "p15", qty: 1, price: price("p15", 1750000) }] },
    { id: "102455", customer: "آرش ر.", date: "۱۴۰۳/۰۸/۱۴", status: "shipping", lines: [{ productId: "p2", qty: 1, price: price("p2", 18900000) }] },
    { id: "102454", customer: "سارا ک.", date: "۱۴۰۳/۰۸/۱۳", status: "processing", lines: [{ productId: "p33", qty: 1, price: price("p33", 62000000) }] },
    { id: "102453", customer: "محمد ت.", date: "۱۴۰۳/۰۸/۱۲", status: "processing", lines: [{ productId: "p3", qty: 1, price: price("p3", 7800000) }] },
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

export function addVendorProduct(draft: VendorDraftProduct) {
  const store = getStoreById(VENDOR_ID);
  const id = `vp-${Date.now().toString(36)}`;
  const sku = `NM-${String(vendorProducts.length + 1).padStart(3, "0")}`;
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
}

export function removeVendorProduct(id: string) {
  vendorProducts = vendorProducts.filter((product) => product.id !== id);
}

// ------------------------------------------------------------
// Orders — derived state + lifecycle
// ------------------------------------------------------------
export function listVendorOrders(): { order: VendorOrder; total: number; storeName: string }[] {
  return orders.map((order) => ({ order, total: orderTotal(order), storeName: getStoreById(VENDOR_ID)?.name ?? "فروشگاه من" }));
}

export function nextOrderStatus(status: VendorOrderStatus): VendorOrderStatus {
  if (status === "processing") return "shipping";
  if (status === "shipping") return "delivered";
  return status;
}

export function advanceVendorOrder(id: string): VendorOrderStatus | null {
  const target = orders.find((order) => order.id === id);
  if (!target) return null;
  const next = nextOrderStatus(target.status);
  if (next !== target.status) {
    orders = orders.map((order) => (order.id === id ? { ...order, status: next } : order));
  }
  return next;
}

export function vendorStats() {
  const active = orders.filter((order) => order.status !== "cancelled");
  const delivered = orders.filter((order) => order.status === "delivered");
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
  if (patch.cover !== undefined) next.cover = patch.cover;
  if (patch.logoChar !== undefined && patch.logoChar.trim()) next.logoChar = patch.logoChar.trim();
  if (patch.logoColor !== undefined && patch.logoColor.trim()) next.logoColor = patch.logoColor.trim();
  if (patch.shippingPolicy !== undefined) next.shippingPolicy = patch.shippingPolicy;
  if (patch.returnPolicy !== undefined) next.returnPolicy = patch.returnPolicy;
  profilePatch = next;
  return vendorStoreProfile();
}
