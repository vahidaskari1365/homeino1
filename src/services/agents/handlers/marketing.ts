// ============================================================
// HOMEINO — MARKETING AGENT
//
// Prompt Stage 4.6: analyse customer segments, products and
// behavior to surface campaign opportunities. It can only DRAFT
// campaigns: sending a campaign or changing prices without human
// approval is forbidden — every draft ends in requestApproval and
// an admin task. No direct sendNotification of campaign content.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";

interface EventLite {
  type?: string;
  userId?: string | null;
  createdAt?: string;
}

interface Segment {
  key: string;
  label: string;
  size: number;
  basis: string;
}

export const runMarketingAgent: AgentHandler = async (input, ctx) => {
  const sinceDays = num(input.sinceDays ?? ctx.agent.config?.sinceDays, 30);
  const limit = num(input.limit, 500);

  const eventsResult = await ctx.callTool("getCustomerEvents", { limit });
  if (!eventsResult.ok) {
    ctx.log("خواندن رویدادهای رفتاری ناموفق بود", { error: eventsResult.error });
    return {
      output: { dataState: "no_data", reason: eventsResult.error ?? "events_query_failed" },
      dataState: "no_data",
    };
  }

  const data = eventsResult.data as { count?: number; events?: EventLite[] };
  const events = data.events ?? [];

  if (!events.length) {
    return {
      output: {
        dataState: "no_data",
        reason: "no_events",
        summary: "هنوز رویداد رفتاری ثبت نشده تا بخش‌بندی مشتریان ساخته شود.",
      },
      dataState: "no_data",
    };
  }

  // Deterministic, rule-based segmentation on real behavior (no LLM needed).
  const viewers = new Set<string>();
  const searchers = new Set<string>();
  const cartAbandoners = new Set<string>();
  for (const event of events) {
    const user = str(event.userId);
    if (!user) continue;
    if (event.type === "product_view" || event.type === "product_click") viewers.add(user);
    if (event.type === "product_search") searchers.add(user);
    if (event.type === "cart_add") cartAbandoners.add(user);
  }

  const segments: Segment[] = [];
  if (viewers.size) segments.push({ key: "engaged-viewers", label: "بازدیدکنندگان درگیر", size: viewers.size, basis: "product_view/click" });
  if (searchers.size) segments.push({ key: "active-searchers", label: "جست‌وجوگران فعال", size: searchers.size, basis: "product_search" });
  if (cartAbandoners.size) segments.push({ key: "cart-abandoners", label: "سبد رهاشده", size: cartAbandoners.size, basis: "cart_add بدون سفارش" });

  // Draft campaigns — never sent, only proposed for human approval.
  const drafts = segments.map((segment) => ({
    segmentKey: segment.key,
    channel: "notification",
    headline: `پیشنهاد کمپین برای «${segment.label}» (${segment.size} مشتری)`,
    body: `بخش ${segment.label} بر اساس ${segment.basis} در ${sinceDays} روز اخیر شناسایی شد. کمپین پیشنهادی پس از تأیید ادمین قابل ارسال است.`,
    status: "draft_requires_approval" as const,
  }));

  const approvalId = await ctx.requestApproval(
    "marketing_campaign_draft",
    `${drafts.length} کمپین پیشنهادی برای ${segments.length} بخش مشتری آماده بررسی است`,
    { segments: segments.map((s) => s.key), sinceDays },
  );

  await ctx.callTool("createTask", {
    title: `بررسی ${drafts.length} کمپین پیشنهادی بازاریابی`,
    type: "marketing_campaign_review",
    priority: 3,
    assigneeRole: "admin",
    payload: { segments, drafts, approvalId: approvalId ?? null, runId: ctx.runId },
  });

  ctx.log(`${segments.length} بخش مشتری و ${drafts.length} کمپین پیش‌نویس ساخته شد — منتظر تأیید انسانی`);

  return {
    output: {
      dataState: "ok",
      sinceDays,
      eventCount: events.length,
      segments,
      drafts,
      approvalId: approvalId ?? null,
      summary: `${segments.length} بخش مشتری شناسایی شد؛ ${drafts.length} کمپین فقط به‌صورت پیش‌نویس — ارسال نیازمند تأیید انسانی است.`,
    },
    dataState: "ok",
    approvalId: approvalId ?? undefined,
  };
};
