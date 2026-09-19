import { count, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { aiDesigns, creditBonusGrants, creditTransactions } from "@/db/schema";
import { grantCredits } from "@/services/creditService";
import { LAUNCH_CAMPAIGN, WELCOME_GIFT } from "@/config/promotions";
import { activeCampaignByCode } from "@/services/coupons";

// ============================================================
// MARKETING SERVICE — honest social proof + welcome gift.
// Every number here comes from the REAL database. When data is
// unavailable or empty the UI hides gracefully — we NEVER fake
// activity or counters (platform rule + Cialdini done ethically).
// ============================================================

export interface LiveActivityItem {
  roomType: string | null;
  style: string | null;
  minutesAgo: number;
}

export interface LiveStats {
  todayDesigns: number; // designs created in the last 24h
  totalDesigns: number;
  recent: LiveActivityItem[];
}

/** Real design stats for social proof (24h window, anonymized). */
export async function getLiveStats(): Promise<LiveStats> {
  if (!process.env.DATABASE_URL) {
    return { todayDesigns: 0, totalDesigns: 0, recent: [] };
  }
  try {
    const db = getDb();
    const since24h = new Date(Date.now() - 24 * 3_600_000);
    const [totals] = await db.select({ value: count() }).from(aiDesigns);
    const [today] = await db
      .select({ value: count() })
      .from(aiDesigns)
      .where(gt(aiDesigns.createdAt, since24h));
    const rows = await db
      .select({ roomType: aiDesigns.roomType, style: aiDesigns.style, createdAt: aiDesigns.createdAt })
      .from(aiDesigns)
      .where(gt(aiDesigns.createdAt, since24h))
      .orderBy(desc(aiDesigns.createdAt))
      .limit(8);
    const recent: LiveActivityItem[] = rows.map((r) => ({
      roomType: r.roomType,
      style: r.style,
      minutesAgo: Math.max(1, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 60_000)),
    }));
    return { todayDesigns: Number(today?.value ?? 0), totalDesigns: Number(totals?.value ?? 0), recent };
  } catch (err) {
    console.warn("[marketing] live stats unavailable:", err instanceof Error ? err.message : err);
    return { todayDesigns: 0, totalDesigns: 0, recent: [] };
  }
}

export interface CampaignPublic {
  active: boolean;
  code: string;
  percentOff: number;
  label: string;
  endsAt: string | null;
  remaining: number | null;
}

/** Live campaign info for banners/countdowns (DB is the source of truth). */
export async function getCampaignPublic(): Promise<CampaignPublic | null> {
  const c = await activeCampaignByCode(LAUNCH_CAMPAIGN.code);
  if (!c) return null;
  return { ...c, active: c.remaining == null ? c.active : c.remaining > 0 && c.active };
}

/**
 * Welcome gift — granted ONCE per user (idempotency key `welcome:<uid>`),
 * tracked in credit_bonus_grants so the credits really EXPIRE after
 * WELCOME_GIFT.hours (swept by creditService.sweepExpiredBonuses).
 */
export async function grantWelcomeBonus(userId: string): Promise<{ granted: boolean; balanceAfter?: number }> {
  if (!process.env.DATABASE_URL) return { granted: false };
  const key = `welcome:${userId}`;
  try {
    const res = await grantCredits(userId, WELCOME_GIFT.credits, {
      type: "bonus",
      operation: "welcome:gift",
      idempotencyKey: key,
      note: `${WELCOME_GIFT.note} — ${WELCOME_GIFT.credits} اعتبار (انقضا: ${WELCOME_GIFT.hours} ساعت)`,
    });
    const db = getDb();
    const [tx] = await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, key))
      .limit(1);
    if (tx) {
      await db
        .insert(creditBonusGrants)
        .values({
          userId,
          transactionId: tx.id,
          amount: WELCOME_GIFT.credits,
          expiresAt: new Date(Date.now() + WELCOME_GIFT.hours * 3_600_000),
        })
        .onConflictDoNothing();
    }
    return { granted: true, balanceAfter: res.balanceAfter };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(msg)) return { granted: false }; // already granted before
    console.warn("[marketing] welcome bonus skipped:", msg);
    return { granted: false };
  }
}
