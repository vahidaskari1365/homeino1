import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  orderItems,
  vendors,
  vendorEarnings,
  vendorPayouts,
  vendorPayoutItems,
} from "@/db/schema";
import { PLATFORM } from "@/config/platform";
import { activeProVendorIds, effectiveCommissionBp } from "@/services/vendorPackage";

// ============================================================
// HOMEINO — Vendor settlement engine
//
// Commission lifecycle (all money in integer Toman):
//
//   payment confirmed  → accrueOrderEarnings()    rows = pending (idempotent per item)
//   item delivered     → markItemsAvailable()     pending → available
//   vendor requests    → requestPayout()          available → settling (+ payout row)
//   admin approves     → settlePayout(markPaid)   settling → paid
//   admin rejects      → rejectPayout()           settling → available (release)
//   order refunded     → reverseOrderEarnings()   any → reversed
//
// The commission rate is snapshotted per earning row, so later rate changes
// never rewrite history. Every write is idempotent or transactional.
// ============================================================

export const DEFAULT_COMMISSION_BP = PLATFORM.vendor.commissionRatePercent * 100;
export const MIN_PAYOUT_TOMAN = PLATFORM.vendor.minPayoutToman;

export function commissionBpFor(vendorRateBp: number | null | undefined): number {
  if (vendorRateBp === null || vendorRateBp === undefined) return DEFAULT_COMMISSION_BP;
  if (vendorRateBp < 0 || vendorRateBp > 10_000) return DEFAULT_COMMISSION_BP;
  return vendorRateBp;
}

/**
 * Snapshot rate for accrual: the PRO package (پکیج فروشنده) overrides the
 * per-vendor/platform rate while its window covers now. Kept as a tiny
 * wrapper so the effective-rate contract lives in ONE place.
 */
export async function effectiveBpForVendor(vendorId: string, vendorRateBp: number | null | undefined): Promise<number> {
  const pro = await activeProVendorIds([vendorId]);
  return effectiveCommissionBp(vendorRateBp, pro.has(vendorId));
}

export function commissionFor(grossToman: number, bp: number): { commissionToman: number; netToman: number } {
  const commissionToman = Math.max(0, Math.round((grossToman * bp) / 10_000));
  return { commissionToman, netToman: Math.max(0, grossToman - commissionToman) };
}

/**
 * Creates the commission ledger for every order item of a paid order.
 * Called from paymentFulfillment when an order is confirmed. Idempotent:
 * the unique index on order_item_id swallows webhook retries.
 */
export async function accrueOrderEarnings(orderId: string): Promise<{ created: number }> {
  const db = getDb();

  const items = await db
    .select({
      id: orderItems.id,
      vendorId: orderItems.vendorId,
      total: orderItems.total,
      refundedAmount: orderItems.refundedAmount,
      itemStatus: orderItems.status,
      vendorRateBp: vendors.commissionRateBp,
    })
    .from(orderItems)
    .innerJoin(vendors, eq(vendors.id, orderItems.vendorId))
    .where(eq(orderItems.orderId, orderId));

  // ONE query for the whole order: which of these vendors hold an active
  // پکیج فروشنده window right now → their effective rate is ۵٪.
  const proActive = await activeProVendorIds([...new Set(items.map((i) => i.vendorId))]);

  let created = 0;
  for (const item of items) {
    const gross = Math.max(0, item.total - (item.refundedAmount ?? 0));
    if (gross <= 0) continue;
    const bp = effectiveCommissionBp(item.vendorRateBp, proActive.has(item.vendorId));
    const { commissionToman, netToman } = commissionFor(gross, bp);
    const deliveredEarly = item.itemStatus === "delivered";
    const result = await db
      .insert(vendorEarnings)
      .values({
        vendorId: item.vendorId,
        orderId,
        orderItemId: item.id,
        grossToman: gross,
        commissionBp: bp,
        commissionToman,
        netToman,
        status: deliveredEarly ? "available" : "pending",
        availableAt: deliveredEarly ? new Date() : null,
      })
      .onConflictDoNothing({ target: vendorEarnings.orderItemId })
      .returning({ id: vendorEarnings.id });
    created += result.length;
  }
  return { created };
}

/** pending → available for the (delivered) items of an order. */
export async function markItemsAvailable(orderItemIds: string[]): Promise<void> {
  if (!orderItemIds.length) return;
  const db = getDb();
  await db
    .update(vendorEarnings)
    .set({ status: "available", availableAt: new Date() })
    .where(and(inArray(vendorEarnings.orderItemId, orderItemIds), eq(vendorEarnings.status, "pending")));
}

/** Refund path: void every earning of the order that has not been paid yet. */
export async function reverseOrderEarnings(orderId: string): Promise<void> {
  const db = getDb();
  await db
    .update(vendorEarnings)
    .set({ status: "reversed" })
    .where(and(eq(vendorEarnings.orderId, orderId), inArray(vendorEarnings.status, ["pending", "available", "settling"])));
  // Note: rows already `paid` stay paid — reversal of settled money goes
  // through an admin-approved negative payout (future work, documented).
}

export interface VendorEarningsSummary {
  pending: number;
  available: number;
  settling: number;
  paid: number;
  totalNet: number;
  itemCount: number;
}

export async function vendorEarningsSummary(vendorId: string): Promise<VendorEarningsSummary> {
  const db = getDb();
  const rows = await db
    .select({
      status: vendorEarnings.status,
      net: sql<number>`coalesce(sum(${vendorEarnings.netToman}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(vendorEarnings)
    .where(eq(vendorEarnings.vendorId, vendorId))
    .groupBy(vendorEarnings.status);

  const by = (s: string) => rows.find((r) => r.status === s);
  return {
    pending: Number(by("pending")?.net ?? 0),
    available: Number(by("available")?.net ?? 0),
    settling: Number(by("settling")?.net ?? 0),
    paid: Number(by("paid")?.net ?? 0),
    totalNet: rows.reduce((sum, r) => sum + Number(r.net ?? 0), 0),
    itemCount: rows.reduce((sum, r) => sum + Number(r.count ?? 0), 0),
  };
}

export type PayoutRequestResult =
  | { ok: true; payoutId: string; amountToman: number; itemCount: number }
  | { ok: false; reason: "below_minimum" | "no_available" | "insufficient"; minToman?: number; availableToman?: number };

/**
 * Vendor payout request — FIFO over available earnings, transactional.
 * The payout starts as `requested`; an admin marks it approved/paid after the
 * bank transfer (or a future gateway does it automatically).
 */
export async function requestPayout(input: {
  vendorId: string;
  requestedBy: string;
  amountToman?: number;
  note?: string;
}): Promise<PayoutRequestResult> {
  const db = getDb();
  const requested = input.amountToman && input.amountToman > 0 ? Math.floor(input.amountToman) : null;

  return db.transaction(async (tx) => {
    // FIFO available earnings, locked to avoid concurrent double-claiming.
    const available = await tx
      .select({ id: vendorEarnings.id, netToman: vendorEarnings.netToman })
      .from(vendorEarnings)
      .where(and(eq(vendorEarnings.vendorId, input.vendorId), eq(vendorEarnings.status, "available")))
      .orderBy(asc(vendorEarnings.availableAt))
      .for("update", { of: vendorEarnings });

    const availableSum = available.reduce((s, r) => s + r.netToman, 0);
    if (!available.length) return { ok: false, reason: "no_available", availableToman: availableSum } as const;
    const amount = requested ?? availableSum;
    if (amount < MIN_PAYOUT_TOMAN) return { ok: false, reason: "below_minimum", minToman: MIN_PAYOUT_TOMAN, availableToman: availableSum } as const;
    if (amount > availableSum) return { ok: false, reason: "insufficient", availableToman: availableSum } as const;

    // pick FIFO items until the amount is covered
    const picked: { id: string; netToman: number }[] = [];
    let covered = 0;
    for (const row of available) {
      if (covered >= amount) break;
      picked.push(row);
      covered += row.netToman;
    }
    const payoutAmount = Math.min(amount, covered);

    const [payout] = await tx
      .insert(vendorPayouts)
      .values({
        vendorId: input.vendorId,
        amountToman: payoutAmount,
        status: "requested",
        method: "manual",
        requestedBy: input.requestedBy,
        note: input.note ?? null,
      })
      .returning({ id: vendorPayouts.id });

    await tx.insert(vendorPayoutItems).values(
      picked.map((row) => ({ payoutId: payout.id, earningId: row.id, amountToman: row.netToman })),
    );
    await tx
      .update(vendorEarnings)
      .set({ status: "settling" })
      .where(inArray(vendorEarnings.id, picked.map((r) => r.id)));

    return { ok: true as const, payoutId: payout.id, amountToman: payoutAmount, itemCount: picked.length };
  });
}

export type AdminPayoutAction = "approve" | "reject" | "mark_paid";

/** Admin settlement: approve / reject / mark paid (with bank reference). */
export async function adminPayoutAction(input: {
  payoutId: string;
  action: AdminPayoutAction;
  adminUserId: string;
  reference?: string;
  note?: string;
}): Promise<{ ok: true; status: string } | { ok: false; reason: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.id, input.payoutId))
      .for("update");
    if (!payout) return { ok: false, reason: "payout_not_found" } as const;

    const itemIds = (
      await tx
        .select({ earningId: vendorPayoutItems.earningId })
        .from(vendorPayoutItems)
        .where(eq(vendorPayoutItems.payoutId, payout.id))
    ).map((r) => r.earningId);

    if (input.action === "approve") {
      if (payout.status !== "requested") return { ok: false, reason: "invalid_state" } as const;
      await tx.update(vendorPayouts)
        .set({ status: "approved", processedBy: input.adminUserId, note: input.note ?? payout.note, updatedAt: new Date() })
        .where(eq(vendorPayouts.id, payout.id));
      return { ok: true as const, status: "approved" };
    }

    if (input.action === "reject") {
      if (payout.status !== "requested" && payout.status !== "approved") return { ok: false, reason: "invalid_state" } as const;
      await tx.update(vendorPayouts)
        .set({ status: "rejected", processedBy: input.adminUserId, processedAt: new Date(), note: input.note ?? payout.note, updatedAt: new Date() })
        .where(eq(vendorPayouts.id, payout.id));
      // release the locked earnings back to available
      if (itemIds.length) {
        await tx.update(vendorEarnings)
          .set({ status: "available" })
          .where(and(inArray(vendorEarnings.id, itemIds), eq(vendorEarnings.status, "settling")));
      }
      return { ok: true as const, status: "rejected" };
    }

    // mark_paid — only from approved (or directly requested for small shops)
    if (payout.status !== "approved" && payout.status !== "requested") return { ok: false, reason: "invalid_state" } as const;
    await tx.update(vendorPayouts)
      .set({
        status: "paid",
        reference: input.reference ?? payout.reference,
        processedBy: input.adminUserId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vendorPayouts.id, payout.id));
    if (itemIds.length) {
      await tx.update(vendorEarnings)
        .set({ status: "paid", settledAt: new Date() })
        .where(and(inArray(vendorEarnings.id, itemIds), eq(vendorEarnings.status, "settling")));
    }
    return { ok: true as const, status: "paid" };
  });
}
