import { addToCart, getOrCreateActiveCart, getCart, clearCart } from "@/services/cartService";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isObject, isOptionalString } from "@/lib/api/validate";
import { PLATFORM } from "@/config/platform";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, products, vendors } from "@/db/schema";

export const runtime = "nodejs";

const FREE_SHIPPING_THRESHOLD = PLATFORM.policies.freeShippingThreshold; // Toman
const SHIPPING_POST = 120_000; // per vendor parcel
const SHIPPING_EXPRESS = 250_000;

/**
 * Mirror the client cart into the DB cart in ONE call:
 * items are resolved by SLUG (the client cart uses catalog slugs); prices and
 * stock come from the DB — never from the client. Returns the authoritative
 * server-side totals (incl. per-vendor shipping) so checkout shows exactly
 * what the order will cost.
 */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) {
    return demoUnavailable("همگام‌سازی سبد (API)", "در حالت دمو، سفارش در مرورگر ثبت می‌شود.");
  }
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    items: isObject,
    shippingMethod: isOptionalString(10),
  }) as { items: unknown; shippingMethod?: string };

  const rawItems = Array.isArray(input.items)
    ? (input.items as Array<Record<string, unknown>>).slice(0, 50)
    : [];
  if (rawItems.length === 0) throw ApiError.badRequest("سبد خرید خالی است");
  const express = input.shippingMethod === "express";

  const slugs = [...new Set(rawItems.map((it) => String(it.slug ?? "").trim()).filter(Boolean))];
  if (slugs.length === 0) throw ApiError.badRequest("سبد خرید خالی است");

  const db = getDb();
  const rows = await db
    .select({ id: products.id, slug: products.slug, title: products.title, status: products.status })
    .from(products)
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(and(inArray(products.slug, slugs), isNull(products.deletedAt)));
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const warnings: string[] = [];
  const resolved: { slug: string; productId: string; quantity: number }[] = [];
  for (const it of rawItems) {
    const slug = String(it.slug ?? "").trim();
    const qty = Math.min(99, Math.max(1, Number(it.quantity ?? 1) || 1));
    const p = bySlug.get(slug);
    if (!p) {
      warnings.push(`«${slug}» در کاتالوگ یافت نشد و حذف شد`);
      continue;
    }
    if (p.status !== "active") {
      warnings.push(`«${p.title}» فعلاً قابل خرید نیست`);
      continue;
    }
    resolved.push({ slug, productId: p.id, quantity: qty });
  }
  if (resolved.length === 0) {
    throw new ApiError("INVALID_INPUT", "هیچ کالای قابل سفارشی نیست", 422);
  }

  const cart = await getOrCreateActiveCart(user.id);

  // Replace semantics: DB rows no longer in the client cart get removed.
  const keepIds = new Set(resolved.map((r) => r.productId));
  const existing = await db
    .select({ id: cartItems.id, productId: cartItems.productId })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id));
  const stale = existing.filter((row) => !keepIds.has(row.productId));
  if (stale.length > 0) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), inArray(cartItems.id, stale.map((s) => s.id))));
  }

  for (const r of resolved) {
    try {
      await addToCart(user.id, { productId: r.productId, quantity: r.quantity });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطای نامشخص";
      warnings.push(`${r.slug}: ${msg}`);
    }
  }

  // Authoritative server totals — DB price snapshots, not client numbers.
  const serverCart = (await getCart(user.id)) as {
    items: Array<{ unitPrice: number; quantity: number; vendorId: string }>;
  };
  const lines = serverCart.items ?? [];
  if (lines.length === 0) {
    await clearCart(user.id);
    throw new ApiError("INVALID_INPUT", "هیچ کالای قابل سفارشی نیست", 422);
  }
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const vendorCount = new Set(lines.map((l) => l.vendorId)).size;
  const shippingTotal =
    vendorCount * (express ? SHIPPING_EXPRESS : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_POST);

  return ok({
    ok: true,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    shippingTotal,
    total: subtotal + shippingTotal,
    warnings,
  });
});
