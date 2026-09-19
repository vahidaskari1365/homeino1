import { describe, expect, it } from "vitest";
import {
  tehranDay,
  dayDiff,
  pickSpinSegment,
  streakRewardFor,
  nextStreak,
} from "./gamification";
import { DAILY_SPIN } from "@/config/promotions";

describe("tehranDay (روز = Asia/Tehran)", () => {
  it("rolls over at midnight Tehran, not UTC", () => {
    // 2026-09-19T21:30:00Z = 2026-09-20 01:00 در تهران → روز بعد
    const lateNightUtc = new Date("2026-09-19T21:30:00Z");
    expect(tehranDay(lateNightUtc)).toBe("2026-09-20");
    // 2026-09-19T19:00:00Z = 22:30 تهران → همان روز
    expect(tehranDay(new Date("2026-09-19T19:00:00Z"))).toBe("2026-09-19");
  });
});

describe("dayDiff", () => {
  it("computes calendar distance", () => {
    expect(dayDiff("2026-09-19", "2026-09-19")).toBe(0);
    expect(dayDiff("2026-09-19", "2026-09-18")).toBe(1);
    expect(dayDiff("2026-09-19", "2026-09-12")).toBe(7);
    expect(dayDiff("2026-09-18", "2026-09-19")).toBe(-1);
  });
});

describe("pickSpinSegment (شانس واقعی، وزن‌ها نرمال می‌شوند)", () => {
  it("only returns segments from the catalog", () => {
    const keys = new Set(DAILY_SPIN.segments.map((s) => s.key));
    for (let i = 0; i < 500; i++) {
      expect(keys.has(pickSpinSegment().key)).toBe(true);
    }
  });

  it("respects the configured odds within sampling tolerance", () => {
    const N = 20_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const seg = pickSpinSegment();
      counts[seg.key] = (counts[seg.key] ?? 0) + 1;
    }
    const total = DAILY_SPIN.segments.reduce((s, x) => s + x.weight, 0);
    for (const seg of DAILY_SPIN.segments) {
      const expected = (seg.weight / total) * N;
      // ±5% مطلق روی فراوانی نمونه — دترمینیسم آماری
      expect(Math.abs((counts[seg.key] ?? 0) - expected)).toBeLessThan(N * 0.05);
    }
  });

  it("honors an injected rng (deterministic)", () => {
    const seg = pickSpinSegment(() => 0.999); // انتهای طیف → آخرین سگمنت (کمی‌یاب‌ترین)
    expect(seg.key).toBe(DAILY_SPIN.segments[DAILY_SPIN.segments.length - 1].key);
  });
});

describe("streakRewardFor", () => {
  it("escalates through the week then caps at the weekly reward", () => {
    expect(streakRewardFor(1)).toBe(2);
    expect(streakRewardFor(3)).toBe(5);
    expect(streakRewardFor(7)).toBe(15);
    expect(streakRewardFor(8)).toBe(15);
    expect(streakRewardFor(14)).toBe(15);
  });
});

describe("nextStreak (یک روز غیبت = ریست)", () => {
  it("starts at 1 with no history", () => {
    expect(nextStreak(null, 0, "2026-09-19")).toBe(1);
  });

  it("continues on a consecutive day", () => {
    expect(nextStreak("2026-09-18", 4, "2026-09-19")).toBe(5);
  });

  it("resets after a missed day", () => {
    expect(nextStreak("2026-09-16", 4, "2026-09-19")).toBe(1);
  });

  it("defends against same-day double calls", () => {
    expect(nextStreak("2026-09-19", 4, "2026-09-19")).toBe(4);
  });
});
