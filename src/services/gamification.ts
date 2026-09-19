import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  gamificationBadges,
  gamificationCheckins,
  gamificationSpins,
  gamificationStreaks,
  referralCodes,
  referrals,
} from "@/db/schema";
import { grantCredits } from "@/services/creditService";
import { DAILY_SPIN, DAILY_STREAK, BADGES } from "@/config/promotions";
import { PLATFORM } from "@/config/platform";

// ============================================================
// HOMEINO — Gamification engine (فاز ۳)
//
// Temu-style loops, house rules:
//   · every reward comes from the REAL credit ledger (idempotency keys)
//   · probabilities are published in config/promotions.ts and shown in UI
//   · "a day" = Asia/Tehran calendar day (the owner's market)
//   · unique indexes are the caps — race conditions cannot double-grant
// ============================================================

/* ---------------- pure helpers (unit-tested) ---------------- */

/** YYYY-MM-DD in Asia/Tehran — the single definition of «امروز». */
export function tehranDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(d);
}

/** Calendar distance in days between two YYYY-MM-DD strings. */
export function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db_ = Date.parse(`${b}T00:00:00Z`);
  return Math.round((da - db_) / 86_400_000);
}

/** Weighted random pick over DAILY_SPIN.segments (normalizes weights). */
export function pickSpinSegment(rand: () => number = Math.random): (typeof DAILY_SPIN.segments)[number] {
  const total = DAILY_SPIN.segments.reduce((s, seg) => s + seg.weight, 0);
  let roll = rand() * total;
  for (const seg of DAILY_SPIN.segments) {
    roll -= seg.weight;
    if (roll < 0) return seg;
  }
  return DAILY_SPIN.segments[DAILY_SPIN.segments.length - 1];
}

/** Streak credits: escalating for the first week, then weekly 15. */
export function streakRewardFor(streakDay: number): number {
  const direct = DAILY_STREAK.rewards[streakDay];
  if (direct !== undefined) return direct;
  return DAILY_STREAK.weeklyReward;
}

/** New streak value when checking in `today`, given last check-in. */
export function nextStreak(lastDate: string | null, currentStreak: number, today: string): number {
  if (!lastDate) return 1;
  const gap = dayDiff(today, lastDate);
  if (gap <= 0) return Math.max(1, currentStreak); // same day (defensive)
  if (gap === 1) return currentStreak + 1;
  return 1; // a missed day resets the streak
}

/* ---------------- spin ---------------- */

export type SpinResult =
  | { ok: true; credits: number; label: string; segmentKey: string; balanceAfter: number; alreadySpun: false }
  | { ok: true; alreadySpun: true; nextSpinAt: string; credits: number; label: string; segmentKey: string; balanceAfter: number }
  | { ok: false; reason: "db_unavailable" };

export async function spinDaily(userId: string): Promise<SpinResult> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "db_unavailable" };
  const db = getDb();
  const today = tehranDay();

  // The unique index is the cap — a race loses here and reads the winner's row.
  const segment = pickSpinSegment();
  const inserted = await db
    .insert(gamificationSpins)
    .values({ userId, spinDate: today, creditsAwarded: segment.credits, rewardKey: segment.key })
    .onConflictDoNothing({ target: [gamificationSpins.userId, gamificationSpins.spinDate] })
    .returning({ id: gamificationSpins.id });

  if (!inserted.length) {
    return {
      ok: true,
      alreadySpun: true,
      nextSpinAt: `${tehranDay(new Date(Date.now() + 86_400_000))}T00:00:00+03:30`,
      credits: 0,
      label: "امروز چرخاندی — فردا دوباره بیا!",
      segmentKey: "none",
      balanceAfter: -1,
    };
  }

  const { balanceAfter } = await grantCredits(userId, segment.credits, {
    type: "bonus",
    operation: "gamification:daily_spin",
    referenceType: "spin",
    referenceId: inserted[0].id,
    idempotencyKey: `spin:${userId}:${today}`,
    note: `چرخ شانس روزانه (${segment.label})`,
  });
  await awardBadge(userId, "spinner").catch(() => undefined);
  await refreshStatsBadges(userId).catch(() => undefined);

  return { ok: true, credits: segment.credits, label: segment.label, segmentKey: segment.key, balanceAfter, alreadySpun: false };
}

/* ---------------- daily check-in streak ---------------- */

export type CheckinResult =
  | { ok: true; credits: number; streak: number; balanceAfter: number; alreadyCheckedIn: false }
  | { ok: true; alreadyCheckedIn: true; streak: number; credits: number; balanceAfter: number }
  | { ok: false; reason: "db_unavailable" };

export async function checkInDaily(userId: string): Promise<CheckinResult> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "db_unavailable" };
  const db = getDb();
  const today = tehranDay();

  const [existing] = await db
    .select({ credits: gamificationCheckins.creditsAwarded, streak: gamificationCheckins.streakAfter })
    .from(gamificationCheckins)
    .where(and(eq(gamificationCheckins.userId, userId), eq(gamificationCheckins.checkinDate, today)))
    .limit(1);
  if (existing) {
    const [streakRow] = await db.select().from(gamificationStreaks).where(eq(gamificationStreaks.userId, userId)).limit(1);
    return { ok: true, alreadyCheckedIn: true, streak: streakRow?.currentStreak ?? existing.streak, credits: existing.credits, balanceAfter: -1 };
  }

  const [streakRow] = await db.select().from(gamificationStreaks).where(eq(gamificationStreaks.userId, userId)).limit(1);
  const streak = nextStreak(streakRow?.lastCheckinDate ?? null, streakRow?.currentStreak ?? 0, today);
  const credits = streakRewardFor(streak);

  return db.transaction(async (tx) => {
    await tx
      .insert(gamificationCheckins)
      .values({ userId, checkinDate: today, streakAfter: streak, creditsAwarded: credits })
      .onConflictDoNothing({ target: [gamificationCheckins.userId, gamificationCheckins.checkinDate] });
    await tx
      .insert(gamificationStreaks)
      .values({
        userId,
        currentStreak: streak,
        longestStreak: streak,
        lastCheckinDate: today,
        totalCheckins: 1,
      })
      .onConflictDoUpdate({
        target: gamificationStreaks.userId,
        set: {
          currentStreak: streak,
          longestStreak: sql`greatest(${gamificationStreaks.longestStreak}, ${streak})`,
          lastCheckinDate: today,
          totalCheckins: sql`${gamificationStreaks.totalCheckins} + 1`,
          updatedAt: new Date(),
        },
      });
    return { _streak: streak, _credits: credits } as const;
  }).then(async ({ _streak, _credits }) => {
    const { balanceAfter } = await grantCredits(userId, _credits, {
      type: "bonus",
      operation: "gamification:daily_checkin",
      referenceType: "checkin",
      referenceId: `checkin:${userId}:${today}`,
      idempotencyKey: `checkin:${userId}:${today}`,
      note: `ورود روزانه — روز ${_streak} استریک`,
    });
    if (_streak >= 7) await awardBadge(userId, "streak_7").catch(() => undefined);
    return { ok: true as const, credits: _credits, streak: _streak, balanceAfter, alreadyCheckedIn: false as const };
  });
}

/* ---------------- referral («بده بگیر») ---------------- */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بدون اعداد/حروف گیج‌کننده

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const db = getDb();
  const [existing] = await db.select({ code: referralCodes.code }).from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 6; attempt++) {
    let code = "H";
    const bytes = new Uint8Array(7);
    crypto.getRandomValues(bytes);
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    const inserted = await db
      .insert(referralCodes)
      .values({ userId, code })
      .onConflictDoNothing({ target: referralCodes.userId })
      .returning({ code: referralCodes.code });
    if (inserted.length) return inserted[0].code;
  }
  // 6 collisions in a row is virtually impossible — deterministic fallback.
  const fallback = `H${userId.replace(/-/g, "").slice(0, 7).toUpperCase()}`;
  const [row] = await db
    .insert(referralCodes)
    .values({ userId, code: fallback })
    .onConflictDoNothing({ target: referralCodes.userId })
    .returning({ code: referralCodes.code });
  return row?.code ?? fallback;
}

/** Called from /api/auth/register when the new user brought a code. Fail-safe. */
export async function applyReferralCode(refereeUserId: string, rawCode: string): Promise<{ applied: boolean; reason?: string }> {
  if (!process.env.DATABASE_URL) return { applied: false, reason: "db_unavailable" };
  const db = getDb();
  const code = String(rawCode ?? "").trim().toUpperCase().slice(0, 16);
  if (!code) return { applied: false, reason: "empty" };

  const [referrer] = await db.select({ userId: referralCodes.userId }).from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
  if (!referrer) return { applied: false, reason: "invalid_code" };
  if (referrer.userId === refereeUserId) return { applied: false, reason: "self" };

  const inserted = await db
    .insert(referrals)
    .values({
      referrerUserId: referrer.userId,
      refereeUserId,
      codeUsed: code,
      status: "pending",
      inviterCredits: PLATFORM.referral.inviterBonus,
      inviteeCredits: PLATFORM.referral.inviteeBonus,
    })
    .onConflictDoNothing({ target: referrals.refereeUserId })
    .returning({ id: referrals.id });
  return { applied: inserted.length > 0, reason: inserted.length ? undefined : "already_referred" };
}

/**
 * Called from paymentFulfillment after the invitee's FIRST successful payment —
 * this is when both sides get their credits (idempotent via status flip).
 */
export async function qualifyReferral(refereeUserId: string): Promise<{ ok: boolean; referrerUserId?: string }> {
  if (!process.env.DATABASE_URL) return { ok: false };
  const db = getDb();

  const [row] = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.refereeUserId, refereeUserId), eq(referrals.status, "pending")))
    .limit(1);
  if (!row) return { ok: false };

  const flipped = await db
    .update(referrals)
    .set({ status: "credited", creditedAt: new Date() })
    .where(and(eq(referrals.id, row.id), eq(referrals.status, "pending")))
    .returning({ id: referrals.id });
  if (!flipped.length) return { ok: false }; // another fulfillment won the race

  await grantCredits(row.referrerUserId, row.inviterCredits, {
    type: "bonus",
    operation: "referral:inviter_bonus",
    referenceType: "referral",
    referenceId: row.id,
    idempotencyKey: `referral-inviter:${row.id}`,
    note: "دعوت دوست — جایزهٔ معرف",
  }).catch(() => undefined);
  await grantCredits(refereeUserId, row.inviteeCredits, {
    type: "bonus",
    operation: "referral:invitee_bonus",
    referenceType: "referral",
    referenceId: row.id,
    idempotencyKey: `referral-invitee:${row.id}`,
    note: "دعوت از دوستان — جایزهٔ دعوت‌شده",
  }).catch(() => undefined);
  await awardBadge(row.referrerUserId, "referrer").catch(() => undefined);

  return { ok: true, referrerUserId: row.referrerUserId };
}

export interface ReferralStats {
  code: string;
  shareMessage: string;
  invited: number;
  credited: number;
  pending: number;
  creditsEarned: number;
}

export async function referralStats(userId: string): Promise<ReferralStats> {
  const db = getDb();
  const code = await getOrCreateReferralCode(userId);
  const rows = await db
    .select({ status: referrals.status, inviterCredits: referrals.inviterCredits })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId));
  const credited = rows.filter((r) => r.status === "credited");
  return {
    code,
    shareMessage: PLATFORM.referral.shareMessage,
    invited: rows.length,
    credited: credited.length,
    pending: rows.length - credited.length,
    creditsEarned: credited.reduce((s, r) => s + r.inviterCredits, 0),
  };
}

/* ---------------- badges + aggregate state ---------------- */

export async function awardBadge(userId: string, badgeKey: string): Promise<{ awarded: boolean }> {
  if (!process.env.DATABASE_URL) return { awarded: false };
  const db = getDb();
  const inserted = await db
    .insert(gamificationBadges)
    .values({ userId, badgeKey })
    .onConflictDoNothing({ target: [gamificationBadges.userId, gamificationBadges.badgeKey] })
    .returning({ id: gamificationBadges.id });
  return { awarded: inserted.length > 0 };
}

/** Badge conditions evaluated from REAL data (designs count from ai_generations). */
export async function refreshStatsBadges(userId: string): Promise<void> {
  try {
    const db = getDb();
    const [{ designs }] = await db
      .select({ designs: sql<number>`count(*)::int` })
      .from(sql`ai_generations`)
      .where(sql`user_id = ${userId}`);
    if (Number(designs) >= 1) await awardBadge(userId, "first_design");
    if (Number(designs) >= 10) await awardBadge(userId, "designer_10");
  } catch {
    // ai_generations may not exist in degraded deployments — badges stay off
  }
}

export async function gamificationState(userId: string) {
  if (!process.env.DATABASE_URL) return null;
  const db = getDb();
  const today = tehranDay();

  const [streakRow] = await db.select().from(gamificationStreaks).where(eq(gamificationStreaks.userId, userId)).limit(1);
  const [todayCheckin] = await db
    .select({ credits: gamificationCheckins.creditsAwarded, streak: gamificationCheckins.streakAfter })
    .from(gamificationCheckins)
    .where(and(eq(gamificationCheckins.userId, userId), eq(gamificationCheckins.checkinDate, today)))
    .limit(1);
  const [todaySpin] = await db
    .select({ credits: gamificationSpins.creditsAwarded, key: gamificationSpins.rewardKey })
    .from(gamificationSpins)
    .where(and(eq(gamificationSpins.userId, userId), eq(gamificationSpins.spinDate, today)))
    .limit(1);
  const badgeRows = await db
    .select({ key: gamificationBadges.badgeKey, awardedAt: gamificationBadges.awardedAt })
    .from(gamificationBadges)
    .where(eq(gamificationBadges.userId, userId));
  const badges = badgeRows;

  return {
    today,
    streak: {
      current: streakRow?.currentStreak ?? 0,
      longest: streakRow?.longestStreak ?? 0,
      totalCheckins: streakRow?.totalCheckins ?? 0,
      checkedInToday: Boolean(todayCheckin),
      todayCredits: todayCheckin?.credits ?? 0,
      nextReward: streakRewardFor(nextStreak(streakRow?.lastCheckinDate ?? null, streakRow?.currentStreak ?? 0, today)),
    },
    spin: {
      available: !todaySpin,
      todayCredits: todaySpin?.credits ?? 0,
      todayKey: todaySpin?.key ?? null,
    },
    badges: badges.map((b) => ({
      ...(BADGES.find((c) => c.key === b.key) ?? { key: b.key, title: b.key, description: "", icon: "sparkles" }),
      awardedAt: b.awardedAt,
    })),
    referral: await referralStats(userId),
  };
}
