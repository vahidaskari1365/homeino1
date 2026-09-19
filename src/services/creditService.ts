import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { creditAccounts, creditTransactions, creditBonusGrants, aiPricing } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Credit ledger — money-grade discipline.
 * - Every mutation writes an IMMUTABLE credit_transactions row.
 * - Balance is derived from a versioned account with optimistic locking.
 * - generation spends and purchase grants are transactional.
 */

export async function ensureAccount(userId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.userId, userId))
    .limit(1);
  if (existing.length) return existing[0];
  await db.insert(creditAccounts).values({ userId });
  return (await db.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)))[0];
}

/**
 * EXPIRING BONUS SWEEP — subtract unused welcome-gift credits whose 48h
 * window has passed. Runs lazily on balance reads/spends; idempotent via
 * the ledger's `bonus-expire:<grantId>` key. Expiration is a balance loss,
 * NOT a spend → lifetimeSpent stays untouched. Fail-safe: any problem is
 * logged and ignored so the caller never breaks.
 */
export async function sweepExpiredBonuses(userId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const db = getDb();
    const open = await db
      .select()
      .from(creditBonusGrants)
      .where(eq(creditBonusGrants.userId, userId))
      .limit(20);
    const now = new Date();
    const expired = open.filter((g) => !g.expiredAt && g.expiresAt < now);
    for (const g of expired) {
      try {
        await db.transaction(async (tx) => {
          const [acc] = await tx
            .select()
            .from(creditAccounts)
            .where(eq(creditAccounts.userId, userId))
            .limit(1)
            .for("update");
          const balance = acc?.balance ?? 0;
          const expiredAmount = Math.min(g.amount, Math.max(0, balance));
          if (expiredAmount > 0) {
            await tx.insert(creditTransactions).values({
              userId,
              type: "expiration",
              amount: -expiredAmount,
              balanceAfter: balance - expiredAmount,
              operation: "bonus:expire",
              referenceType: "bonus_grant",
              referenceId: g.id,
              idempotencyKey: `bonus-expire:${g.id}`,
              status: "committed",
              note: "انقضای اعتبار هدیه",
            });
            await tx
              .update(creditAccounts)
              .set({ balance: balance - expiredAmount, version: (acc?.version ?? 0) + 1 })
              .where(eq(creditAccounts.userId, userId));
          }
          await tx
            .update(creditBonusGrants)
            .set({ expiredAt: now, expiredAmount })
            .where(eq(creditBonusGrants.id, g.id));
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/duplicate|unique/i.test(msg)) continue; // concurrent sweep already handled it
        console.warn("[credits] bonus sweep row failed:", msg);
      }
    }
  } catch (err) {
    console.warn("[credits] bonus sweep unavailable:", err instanceof Error ? err.message : err);
  }
}

export async function getBalance(userId: string) {
  await sweepExpiredBonuses(userId);
  const acc = await ensureAccount(userId);
  return { balance: acc.balance, lifetimeEarned: acc.lifetimeEarned, lifetimeSpent: acc.lifetimeSpent };
}

export async function getTransactions(userId: string, limit = 50, offset = 0) {
  const db = getDb();
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Atomically spend credits. `reason` is an immutable audit string.
 * Throws INSUFFICIENT_CREDITS when balance can't cover `amount`.
 */
export async function spendCredits(
  userId: string,
  amount: number,
  opts: {
    operation: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    note?: string;
  },
): Promise<{ balanceAfter: number }> {
  const db = getDb();
  if (!Number.isInteger(amount) || amount <= 0) throw ApiError.badRequest("مقدار نامعتبر است");
  await sweepExpiredBonuses(userId);
  return db.transaction(async (tx) => {
    let [acc] = await tx
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId))
      .limit(1)
      .for("update");
    if (!acc) {
      await tx.insert(creditAccounts).values({ userId });
      const [created] = await tx
        .select()
        .from(creditAccounts)
        .where(eq(creditAccounts.userId, userId))
        .limit(1)
        .for("update");
      if (!created) throw new ApiError("INTERNAL", "ایجاد حساب اعتباری ممکن نشد");
      acc = created;
    }
    if (acc.balance < amount) {
      throw new ApiError("INSUFFICIENT_CREDITS", "اعتبار کافی نیست", 422, {
        balance: acc.balance,
        required: amount,
      });
    }
    const balanceAfter = acc.balance - amount;
    await tx.insert(creditTransactions).values({
      userId,
      type: "generation",
      amount: -amount,
      balanceAfter,
      operation: opts.operation,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      idempotencyKey: opts.idempotencyKey,
      status: "committed",
      note: opts.note,
    });
    await tx
      .update(creditAccounts)
      .set({
        balance: balanceAfter,
        lifetimeSpent: acc.lifetimeSpent + amount,
        version: acc.version + 1,
      })
      .where(eq(creditAccounts.userId, userId));
    return { balanceAfter };
  });
}

/** Atomically grant credits (purchase, bonus, refund, admin). */
export async function grantCredits(
  userId: string,
  amount: number,
  opts: {
    type: "purchase" | "bonus" | "refund" | "admin_adjustment";
    operation: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    note?: string;
  },
): Promise<{ balanceAfter: number }> {
  const db = getDb();
  if (!Number.isInteger(amount) || amount <= 0) throw ApiError.badRequest("مقدار نامعتبر است");
  return db.transaction(async (tx) => {
    const [acc] = await tx
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId))
      .limit(1)
      .for("update");
    const account = acc ?? (await ensureAccount(userId));
    const balanceAfter = account.balance + amount;
    await tx.insert(creditTransactions).values({
      userId,
      type: opts.type,
      amount,
      balanceAfter,
      operation: opts.operation,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      idempotencyKey: opts.idempotencyKey,
      status: "committed",
      note: opts.note,
    });
    await tx
      .update(creditAccounts)
      .set({
        balance: balanceAfter,
        lifetimeEarned: account.lifetimeEarned + amount,
        version: account.version + 1,
      })
      .where(eq(creditAccounts.userId, userId));
    return { balanceAfter };
  });
}

export function priceOf(mode: string): number {
  // Offline/demo fallback — the `ai_pricing` table (when seeded) is the truth.
  const base: Record<string, number> = {
    "room-redesign": 5,
    "prompt-to-design": 5,
    "image-edit": 3,
    "product-in-room": 4,
    "decor-suggest": 6,
    "full-concept": 8,
  };
  return base[mode] ?? 5;
}

/** DB-backed price resolution with an honest in-code fallback. Never throws. */
export async function resolvePrice(mode: string): Promise<number> {
  if (!process.env.DATABASE_URL) return priceOf(mode);
  try {
    const db = getDb();
    const rows = await db
      .select({ price: aiPricing.price })
      .from(aiPricing)
      .where(eq(aiPricing.action, mode))
      .limit(1);
    if (rows[0]?.price != null && rows[0].price > 0) return rows[0].price;
  } catch {
    // ai_pricing missing/unreachable → sane fallback
  }
  return priceOf(mode);
}