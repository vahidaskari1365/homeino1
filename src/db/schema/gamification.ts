import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, id, timestamps } from "./_base";
import { users } from "./users";

// ---------------------------------------------------------------
// Gamification (فاز ۳ — سبک Temu اما صادقانه): چرخ شانس روزانه،
// استریک ورود روزانه، رفرال، نشان‌ها. همهٔ جداول فقط سمت سرور:
// RLS فعال بدون پالیسی کلاینت (اپ به‌عنوان owner از RLS عبور می‌کند).
// "روز" همیشه بر اساس Asia/Tehran محاسبه می‌شود (tehranDay).
// ---------------------------------------------------------------

/** One spin per user per Tehran-day. The unique pair IS the daily cap. */
export const gamificationSpins = pgTable(
  "gamification_spins",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spinDate: date("spin_date").notNull(),
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    rewardKey: varchar("reward_key", { length: 40 }).notNull().default("c3"),
    createdAt: createdAtColumn,
  },
  (t) => [uniqueIndex("gamification_spins_daily_unique").on(t.userId, t.spinDate)],
);

/** Daily check-in ledger — unique (user, day) makes double-claim impossible. */
export const gamificationCheckins = pgTable(
  "gamification_checkins",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkinDate: date("checkin_date").notNull(),
    streakAfter: integer("streak_after").notNull().default(1),
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    createdAt: createdAtColumn,
  },
  (t) => [uniqueIndex("gamification_checkins_daily_unique").on(t.userId, t.checkinDate)],
);

/** Aggregated streak state — one row per user, updated transactionally. */
export const gamificationStreaks = pgTable("gamification_streaks", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCheckinDate: date("last_checkin_date"),
  totalCheckins: integer("total_checkins").notNull().default(0),
  ...timestamps,
});

/** Stable invite codes — one per user. */
export const referralCodes = pgTable(
  "referral_codes",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 16 }).notNull(),
    createdAt: createdAtColumn,
  },
  (t) => [uniqueIndex("referral_codes_code_unique").on(t.code)],
);

/**
 * Referral tracking. A row is created the moment a new user signs up with a
 * code (status=pending) and flips to credited after the invitee's FIRST
 * completed payment — fraud-resistant (bonus is never granted for empty accounts).
 */
export const referrals = pgTable(
  "referrals",
  {
    id: id(),
    referrerUserId: uuid("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refereeUserId: uuid("referee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeUsed: varchar("code_used", { length: 16 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | credited
    inviterCredits: integer("inviter_credits").notNull().default(0),
    inviteeCredits: integer("invitee_credits").notNull().default(0),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    note: text("note"),
    createdAt: createdAtColumn,
  },
  (t) => [
    // a user can be referred only once — forever (idempotency anchor)
    uniqueIndex("referrals_referee_unique").on(t.refereeUserId),
    index("referrals_referrer_idx").on(t.referrerUserId, t.status),
  ],
);

/** Achievement badges — append-only, unique per (user, badge). */
export const gamificationBadges = pgTable(
  "gamification_badges",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeKey: varchar("badge_key", { length: 40 }).notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("gamification_badges_unique").on(t.userId, t.badgeKey)],
);

export type GamificationSpin = typeof gamificationSpins.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
