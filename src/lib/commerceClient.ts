"use client";

/**
 * Commerce client — the single bridge between the storefront UI and the real
 * backend (orders, cart sync, auth, credits, newsletter, reviews).
 *
 * Every helper returns a discriminated result instead of throwing, so callers
 * can fall back to the honest local/demo layer when the server is unavailable
 * (no DATABASE_URL, logged-out, network error). Sample mode must always work;
 * when the real backend is configured the same UI hits the real APIs.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string; message?: string };

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
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
}

/* ---------------- AUTH ---------------- */

export interface MeUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export function loginRequest(email: string, password: string) {
  return call<{ user: MeUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}
export function registerRequest(input: { email: string; password: string; name?: string; phone?: string; isVendor?: boolean; brandName?: string }) {
  return call<{ user: MeUser }>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}
export function logoutRequest() {
  return call<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}
export function fetchMe() {
  return call<{ user: MeUser | null }>("/api/auth/me");
}

/* ---------------- CART + ORDERS ---------------- */

export interface SyncTotals {
  itemCount: number;
  subtotal: number;
  shippingTotal: number;
  total: number;
  warnings: string[];
}

export function syncCart(items: { slug: string; quantity: number }[], shippingMethod: "post" | "express") {
  return call<SyncTotals>("/api/cart/sync", {
    method: "POST",
    body: JSON.stringify({ items, shippingMethod }),
  });
}

export interface ServerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export function createServerOrder(input: {
  shippingAddress: Record<string, unknown>;
  customerNote?: string;
}) {
  return call<ServerOrder>("/api/orders", { method: "POST", body: JSON.stringify(input) });
}

export function fetchServerOrders(page = 1) {
  return call<{ items: ServerOrder[]; meta?: { total?: number } }>(`/api/orders?page=${page}`);
}

/* ---------------- CREDITS ---------------- */

export interface PurchaseIntent {
  pack: string;
  credits: number;
  amount: number;
  paymentId: string;
  provider: string;
  confirmable: boolean;
}

export function purchaseCredits(pack: string) {
  return call<PurchaseIntent>(`/api/credits/purchase?pack=${encodeURIComponent(pack)}`, { method: "POST" });
}

export function confirmCreditsPurchase(paymentId: string, pack: string) {
  return call<{ duplicate: boolean; credits: number }>("/api/credits/purchase/confirm", {
    method: "POST",
    body: JSON.stringify({ paymentId, pack }),
  });
}

export function fetchCreditsBalance() {
  return call<{ balance: number }>("/api/credits");
}

/* ---------------- NEWSLETTER + REVIEWS ---------------- */

export function subscribeNewsletter(input: { email?: string; phone?: string; source?: string }) {
  return call<{ message?: string; demo?: boolean }>("/api/newsletter", { method: "POST", body: JSON.stringify(input) });
}

export interface ServerReview {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  createdAt: string;
  userName?: string;
}

export function fetchProductReviews(productId: string) {
  return call<{ items: ServerReview[] }>(`/api/reviews?product=${encodeURIComponent(productId)}`);
}

export function createProductReview(input: { productId: string; rating: number; title?: string; content?: string }) {
  return call<ServerReview>("/api/reviews", { method: "POST", body: JSON.stringify(input) });
}
