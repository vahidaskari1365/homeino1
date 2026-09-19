"use client";

/**
 * Vendor client — the single bridge between the vendor/admin panels and the
 * real marketplace backend (vendor session, products, orders, earnings,
 * payouts, settings, admin verification).
 *
 * Same contract as commerceClient: every helper returns a discriminated
 * result instead of throwing, so callers can fall back to the honest local
 * demo layer ONLY on 503 + code=DEMO_MODE (DB-less deployment) or a network
 * failure (status 0). Every other failure (401/403/404/500…) must surface as
 * an honest Persian error — demo data is NEVER substituted for real errors.
 *
 * Money in this module is always an integer amount of تومان (DB native).
 */

import { toFa } from "@/lib/utils";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string; message?: string };

/** The only two situations where falling back to the demo store is honest. */
export function isDemoFallback(res: { status: number; code?: string }): boolean {
  return (res.status === 503 && res.code === "DEMO_MODE") || res.status === 0;
}

/** Integer Toman → «۱۲,۵۰۰,۰۰۰ تومان» (Persian digits, panel-ready). */
export function toman(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${toFa(Number(value).toLocaleString("en-US"))} تومان`;
}

/** Basis points → percent label: 800 → «۸٪». */
export function bpToPercentLabel(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return "—";
  const percent = bp / 100;
  return `${toFa(Number.isInteger(percent) ? String(percent) : percent.toFixed(1))}٪`;
}

/** ISO timestamp → fa-IR medium date («۱۴۰۳/۸/۱۵» style), safe on bad input. */
export function faDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/* ---------------- core call (+ auto session refresh on 401) ---------------- */

/** Single-flight session refresh: concurrent 401s share one refresh call. */
let refreshInFlight: Promise<boolean> | null = null;
async function refreshSessionOnce(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const attempt = async (): Promise<ApiResult<T>> => {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || body.ok === false) {
        const err = body.error as { code?: string; message?: string } | undefined;
        return { ok: false, status: res.status, code: (body.code as string) ?? err?.code, message: (body.message as string) ?? err?.message };
      }
      return { ok: true, data: body.data as T };
    } catch {
      return { ok: false, status: 0, code: "NETWORK" };
    }
  };

  const first = await attempt();
  // The Supabase access token lives ~1h in the cookie. When it expires the
  // server answers 401 while the refresh-token cookie is still valid — rotate
  // once and retry transparently instead of failing the user's action.
  if (!first.ok && first.status === 401 && !url.startsWith("/api/auth/")) {
    const refreshed = await refreshSessionOnce();
    if (refreshed) return attempt();
  }
  return first;
}

/* ---------------- VENDOR SESSION (/api/vendor/me) ---------------- */

export interface VendorMe {
  vendor: {
    id: string;
    name: string;
    slug: string;
    status: string; // pending | active | suspended | rejected
    verificationStatus: string; // unverified | pending | verified
    city: string | null;
    description: string | null;
    /** null → پلتفرم از نرخ پیش‌فرض استفاده می‌کند (PLATFORM.vendor). */
    commissionRatePercent: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  member: { role: string; permissions: string[] };
  summary: {
    pending: number;
    available: number;
    settling: number;
    paid: number;
    totalNet: number;
    itemCount: number;
  };
  payoutSettings: { shaba: string | null; cardNumber: string | null; accountHolderName: string | null; payoutsEnabled: boolean } | null;
  verificationLog: { action: string; note: string | null; createdAt: string }[];
}

export function fetchVendorMe() {
  return call<VendorMe>("/api/vendor/me");
}

/**
 * Cached session probe — the vendor pages AND the vendor layout share one
 * /api/vendor/me per tab session (mode banner + onboarding gate). Invalidate
 * after onboarding/settings mutations.
 */
let meCache: ApiResult<VendorMe> | null = null;
let meCacheInFlight: Promise<ApiResult<VendorMe>> | null = null;

export function fetchVendorMeCached(force = false): Promise<ApiResult<VendorMe>> {
  if (!force && meCache) return Promise.resolve(meCache);
  meCacheInFlight ??= fetchVendorMe().then((res) => {
    meCache = res;
    meCacheInFlight = null;
    return res;
  });
  return meCacheInFlight;
}

export function invalidateVendorMeCache() {
  meCache = null;
}

export function vendorOnboard(input: { name: string; city?: string; contactEmail?: string; contactPhone?: string; description?: string }) {
  return call<{ vendorId: string; status: string; created: boolean }>("/api/vendor/onboarding", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------------- PRODUCTS (/api/vendor/products) ---------------- */

export interface VendorProductRow {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  status: string; // draft | active | out_of_stock | archived
  image: string | null;
  quantity: number | null;
  reservedQuantity: number | null;
  lowStockThreshold: number | null;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function fetchVendorProducts(page = 1, limit = 50) {
  return call<{ items: VendorProductRow[]; meta: PageMeta }>(`/api/vendor/products?page=${page}&limit=${limit}`);
}

export function createVendorProduct(input: {
  title: string;
  price: number;
  quantity?: number;
  description?: string;
  shortDescription?: string;
  brand?: string;
  material?: string;
  color?: string;
  imageUrl?: string;
}) {
  return call<{ id: string; slug: string; status: string }>("/api/vendor/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVendorProduct(
  productId: string,
  patch: { title?: string; price?: number; compareAtPrice?: number; quantity?: number; status?: "draft" | "active" | "out_of_stock" | "archived"; description?: string; imageUrl?: string },
) {
  return call<{ id: string; title: string; price: number; status: string }>(`/api/vendor/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteVendorProduct(productId: string) {
  return call<{ deleted: boolean }>(`/api/vendor/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
}

/* ---------------- IMAGE UPLOAD (/api/vendor/uploads — multipart) ---------------- */

/** گزارش عملیات ایجنت استانداردسازی تصویر — دقیقاً همان چیزی که سرور انجام داد. */
export interface ProductImageReportDTO {
  original: { format: string; width: number; height: number; bytes: number };
  output: { format: string; width: number; height: number; bytes: number };
  actions: string[];
  warnings: string[];
}

export interface ProductImageUploadDTO {
  url: string;
  storage: string; // r2 | supabase
  width: number;
  height: number;
  bytes: number;
  report: ProductImageReportDTO;
}

function parseXhrBody(xhr: XMLHttpRequest): Record<string, unknown> {
  try {
    return (xhr.responseType === "json" ? xhr.response : JSON.parse(xhr.responseText)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * آپلود multipart تصویر محصول با پیشرفت واقعی (XHR — fetch پروگرس ندارد).
 * همان قرارداد call(): نتیجهٔ تفکیک‌شده، رفرش یک‌بارهٔ نشست روی 401، و
 * هرگز خطای شبکه را موفق جلوه نمی‌دهد. عکس روی سرور خودکار به استاندارد
 * سایت تبدیل می‌شود (ایجنت استانداردسازی تصویر).
 */
export function uploadProductImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ApiResult<ProductImageUploadDTO>> {
  const send = () =>
    new Promise<ApiResult<ProductImageUploadDTO>>((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vendor/uploads");
        xhr.responseType = "json";
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.onload = () => {
          if (onProgress) onProgress(100);
          const body = parseXhrBody(xhr) as Record<string, unknown>;
          if (xhr.status >= 200 && xhr.status < 300 && body.ok !== false) {
            resolve({ ok: true, data: body.data as ProductImageUploadDTO });
          } else {
            const err = body.error as { code?: string; message?: string } | undefined;
            resolve({
              ok: false,
              status: xhr.status,
              code: (body.code as string) ?? err?.code,
              message: (body.message as string) ?? err?.message,
            });
          }
        };
        xhr.onerror = () => resolve({ ok: false, status: 0, code: "NETWORK" });
        xhr.ontimeout = () => resolve({ ok: false, status: 0, code: "NETWORK" });
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      } catch {
        resolve({ ok: false, status: 0, code: "NETWORK" });
      }
    });

  return (async () => {
    const first = await send();
    if (!first.ok && first.status === 401) {
      const refreshed = await refreshSessionOnce();
      if (refreshed) return send();
    }
    return first;
  })();
}

/* ---------------- ORDERS (/api/vendor/orders) ---------------- */

export type VendorItemStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export interface VendorOrderItemRow {
  itemId: string;
  itemStatus: VendorItemStatus;
  title: string;
  quantity: number;
  unitPrice: number;
  total: number;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  placedAt: string;
  customerNote: string | null;
}

export function fetchVendorOrders(status?: string, page = 1, limit = 50) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== "all") q.set("status", status);
  return call<{ items: VendorOrderItemRow[]; meta: PageMeta }>(`/api/vendor/orders?${q.toString()}`);
}

/**
 * Legal next ITEM transitions (mirrors the server-side state machine — the
 * UI never offers an illegal button, and the server enforces it anyway).
 */
const ITEM_TRANSITIONS: Record<VendorItemStatus, readonly VendorItemStatus[]> = {
  pending: ["confirmed"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function legalNextItemStatuses(status: VendorItemStatus): VendorItemStatus[] {
  return [...(ITEM_TRANSITIONS[status] ?? [])];
}

export function advanceVendorOrderItem(itemId: string, status: VendorItemStatus) {
  return call<{ id: string; status: string }>(`/api/vendor/orders/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/* ---------------- EARNINGS (/api/vendor/earnings) ---------------- */

export interface EarningsSummary {
  pending: number;
  available: number;
  settling: number;
  paid: number;
  totalNet: number;
  itemCount: number;
}

export interface VendorEarningRow {
  id: string;
  orderId: string;
  grossToman: number;
  commissionBp: number;
  commissionToman: number;
  netToman: number;
  status: string; // pending | available | settling | paid | reversed
  availableAt: string | null;
  settledAt: string | null;
  createdAt: string;
}

export function fetchVendorEarnings(page = 1, limit = 20) {
  return call<{ summary: EarningsSummary; items: VendorEarningRow[] }>(`/api/vendor/earnings?page=${page}&limit=${limit}`);
}

/* ---------------- PAYOUTS (/api/vendor/payouts) ---------------- */

export interface VendorPayoutRow {
  id: string;
  amountToman: number;
  status: string; // requested | approved | paid | rejected
  method: string;
  reference: string | null;
  processedAt: string | null;
  createdAt: string;
}

export function fetchVendorPayouts(page = 1, limit = 20) {
  return call<{ items: VendorPayoutRow[]; summary: EarningsSummary }>(`/api/vendor/payouts?page=${page}&limit=${limit}`);
}

export function requestVendorPayout(input: { amountToman?: number; note?: string }) {
  return call<{ payoutId: string; amountToman: number; itemCount: number }>("/api/vendor/payouts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------------- STORE SETTINGS (/api/vendor/settings) ---------------- */

export function updateVendorSettings(patch: {
  description?: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  shippingPolicy?: string;
  returnPolicy?: string;
  accountHolderName?: string;
  cardNumber?: string;
  shaba?: string;
}) {
  return call<{ saved: boolean }>("/api/vendor/settings", { method: "PATCH", body: JSON.stringify(patch) });
}

/** شبا: IR + exactly 24 digits (Persian/Arabic digits normalized). */
export function normalizeShaba(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidShaba(raw: string): boolean {
  return /^IR\d{24}$/.test(normalizeShaba(raw));
}

/** کارکت بانکی: دقیقاً ۱۶ رقم. */
export function normalizeCardNumber(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "");
}

export function isValidCardNumber(raw: string): boolean {
  return /^\d{16}$/.test(normalizeCardNumber(raw));
}

/* ---------------- ADMIN — VENDORS (/api/admin/vendors) ---------------- */

export interface AdminVendorRow {
  id: string;
  name: string;
  slug: string;
  status: string; // pending | active | suspended | rejected
  verificationStatus: string;
  city: string | null;
  commissionRateBp: number | null;
  /** Drizzle numeric → JSON string («۸٫۵۰» kept honest as delivered). */
  rating: string | number;
  salesCount: number;
  createdAt: string;
  ownerEmail: string | null;
  ownerId: string | null;
  pendingNetToman: number;
}

export function fetchAdminVendors(status?: string, page = 1, limit = 50) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);
  return call<{ items: AdminVendorRow[]; meta: PageMeta }>(`/api/admin/vendors?${q.toString()}`);
}

export function adminVendorAction(
  vendorId: string,
  input: { action: "approve" | "reject" | "suspend" | "reactivate" | "verify" | "unverify"; note?: string; commissionRateBp?: number },
) {
  return call<{ id: string; status: string; verificationStatus: string; commissionRateBp: number | null }>(
    `/api/admin/vendors/${encodeURIComponent(vendorId)}`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

/* ---------------- ADMIN — PAYOUTS (/api/admin/payouts) ---------------- */

export interface AdminPayoutRow {
  id: string;
  vendorId: string;
  vendorName: string | null;
  amountToman: number;
  status: string; // requested | approved | paid | rejected
  method: string;
  reference: string | null;
  note: string | null;
  processedAt: string | null;
  createdAt: string;
}

export function fetchAdminPayouts(status?: string, page = 1, limit = 50) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) q.set("status", status);
  return call<{ items: AdminPayoutRow[]; meta: PageMeta }>(`/api/admin/payouts?${q.toString()}`);
}

export function adminPayoutAction(
  payoutId: string,
  input: { action: "approve" | "reject" | "mark_paid"; reference?: string; note?: string },
) {
  return call<{ ok: true; status: string }>(`/api/admin/payouts/${encodeURIComponent(payoutId)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------------- Persian status labels (shared by panels) ---------------- */

export const VENDOR_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار تأیید مدیر",
  active: "فعال",
  suspended: "تعلیق شده",
  rejected: "رد شده",
};

export const VENDOR_STATUS_TONE: Record<string, "gold" | "success" | "accent" | "dark"> = {
  pending: "gold",
  active: "success",
  suspended: "accent",
  rejected: "dark",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  verified: "هویت تأیید شده",
  pending: "هویت در انتظار بررسی",
  unverified: "هویت تأیید نشده",
};

export const EARNING_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار تحویل",
  available: "قابل تسویه",
  settling: "در جریان تسویه",
  paid: "تسویه شده",
  reversed: "باطل شده",
};

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  requested: "در انتظار بررسی",
  approved: "تأیید شده",
  paid: "واریز شد",
  rejected: "رد شد",
};

export const PAYOUT_STATUS_TONE: Record<string, "gold" | "accent" | "success" | "dark"> = {
  requested: "gold",
  approved: "accent",
  paid: "success",
  rejected: "dark",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  out_of_stock: "ناموجود",
  archived: "بایگانی",
};

export const PRODUCT_STATUS_TONE: Record<string, "neutral" | "success" | "gold" | "dark"> = {
  draft: "neutral",
  active: "success",
  out_of_stock: "gold",
  archived: "dark",
};

export const ITEM_STATUS_LABEL: Record<VendorItemStatus, string> = {
  pending: "در انتظار تأیید",
  confirmed: "تأیید شده",
  processing: "در حال پردازش",
  shipped: "ارسال شده",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
};

/** دکمهٔ پیشرفت وضعیت آیتم — برچسب فارسی هر گذار مجاز. */
export const ITEM_TRANSITION_LABEL: Record<VendorItemStatus, string> = {
  confirmed: "تأیید سفارش",
  processing: "در حال پردازش",
  shipped: "ارسال شد",
  delivered: "تحویل شد",
  cancelled: "لغو سفارش",
  pending: "",
};

export const VERIFICATION_LOG_LABEL: Record<string, string> = {
  approved: "تأیید",
  rejected: "رد",
  suspended: "تعلیق",
  reactivated: "فعال‌سازی مجدد",
  changes_requested: "نیاز به اصلاح",
};
