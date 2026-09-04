// ============================================================
// HOMEINO — CUSTOMER INTELLIGENCE AGENT
//
// Reads real behaviour (events, wishlist, cart, orders, searches) and produces
// a CustomerProfile + long-term memory entries. It never claims to know a
// preference it has no evidence for — `dataState` says exactly how much real
// signal existed.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";
import type { CustomerProfileSnapshot } from "../types";

export const runCustomerIntelligence: AgentHandler = async (input, ctx) => {
  const userId = str(input.userId) ?? ctx.userId;
  const sessionId = str(input.sessionId) ?? ctx.sessionId;
  const minEvents = num(input.minEvents ?? ctx.agent.config?.minEvents, 3);

  if (!userId && !sessionId) {
    ctx.log("هیچ کاربر یا نشستی برای تحلیل وجود ندارد");
    return {
      output: { dataState: "no_data", reason: "no_user_or_session", profile: null, eventCount: 0 },
      dataState: "no_data",
    };
  }

  // 1. How much real evidence do we have?
  const eventsResult = await ctx.callTool("getCustomerEvents", { userId, sessionId, limit: 500 });
  const eventCount = eventsResult.ok ? num((eventsResult.data as { count?: number })?.count, 0) : 0;
  ctx.log(`تعداد رویدادهای رفتاری: ${eventCount}`, { eventCount });

  if (eventCount === 0) {
    return {
      output: { dataState: "no_data", reason: "no_events", profile: null, eventCount: 0 },
      dataState: "no_data",
    };
  }

  // 2. Recompute + persist the profile from those events (tool-gated write).
  const profileResult = await ctx.callTool("updateCustomerProfile", { userId, sessionId });
  const profile = (profileResult.data as { profile?: CustomerProfileSnapshot | null })?.profile ?? null;

  if (!profileResult.ok || !profile) {
    ctx.log("به‌روزرسانی پروفایل ناموفق بود", { error: profileResult.error });
    return {
      output: { dataState: "not_enough_data", reason: profileResult.error ?? "profile_failed", eventCount, profile: null },
      dataState: "not_enough_data",
    };
  }

  // 3. Remember the triggering interaction (Mem0-shaped memory records).
  const triggerEvent = input.event as Record<string, unknown> | undefined;
  if (userId && triggerEvent && str(triggerEvent.eventType)) {
    const entityType = str(triggerEvent.entityType) ?? "event";
    const entityId = str(triggerEvent.entityId);
    await ctx.callTool("remember", {
      userId,
      kind: "interaction",
      key: `${String(triggerEvent.eventType)}:${entityId ?? "unknown"}`,
      text: `رویداد ${String(triggerEvent.eventType)}${entityId ? ` روی ${entityType} ${entityId}` : ""}`,
      value: { eventType: triggerEvent.eventType, entityType, entityId: entityId ?? null, at: new Date().toISOString() },
      importance: 1,
      entityType,
      entityId: entityId ?? undefined,
    });
  }

  // 4. Keep the strongest preferences as durable memory entries.
  if (userId && profile.dataState !== "no_data") {
    const highlights: [string, string[]][] = [
      ["style", profile.preferredStyles],
      ["color", profile.preferredColors],
      ["category", profile.preferredCategories],
    ];
    for (const [kind, values] of highlights) {
      for (const value of values.slice(0, 3)) {
        await ctx.callTool("remember", {
          userId,
          kind: "preference",
          key: `${kind}:${value}`,
          text: `ترجیح مشتری: ${kind} = ${value}`,
          value: { kind, value, confidence: profile.confidence, evidenceEvents: profile.eventCount },
          importance: Math.max(1, Math.round(profile.confidence * 5)),
        });
      }
    }
  }

  const dataState = profile.dataState === "ok" && profile.eventCount >= minEvents ? "ok" : "not_enough_data";

  return {
    output: {
      dataState: profile.dataState,
      eventCount: profile.eventCount,
      confidence: profile.confidence,
      profile,
      summary:
        profile.dataState === "no_data"
          ? "داده‌ی رفتاری کافی برای ساخت پروفایل وجود ندارد."
          : `پروفایل مشتری از ${profile.eventCount} رویداد واقعی ساخته شد (اطمینان ${Math.round(profile.confidence * 100)}٪).`,
      minEvents,
    },
    dataState,
  };
};
