// ============================================================
// HOMEINO — EVENT TRACKER (behavior → analytics_events → workflows)
//
// Replaces the old localStorage-only queue with a real server-side event bus:
//   1. persist the event to analytics_events (Supabase when configured,
//      in-process otherwise)
//   2. mirror meaningful events into customer_memories (Mem0-style long term
//      memory — the local table is always authoritative)
//   3. fire every ACTIVE workflow whose trigger listens to this event type
//
// Fire-and-forget by design: tracking must never slow down or break the UI.
// ============================================================
import { getStore } from "../agents/store";
import { customerMemory } from "../memory/customerMemory";
import { TRACKED_EVENT_TYPES } from "../memory/preferenceEngine";
import { executeWorkflowByKey } from "./engine";
import { storeMode } from "../agents/store";

export const KNOWN_EVENT_TYPES = TRACKED_EVENT_TYPES;

export interface TrackedEventInput {
  userId?: string | null;
  sessionId?: string | null;
  anonymousId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown>;
  device?: string | null;
  platform?: string | null;
  occurredAt?: Date;
}

export interface TrackResult {
  recorded: boolean;
  eventId: string | null;
  eventType: string;
  dataState: "ok" | "no_data" | "degraded";
  matchedWorkflows: string[];
  storeMode: "database" | "memory";
}

const MEMORY_WORTHY = new Set([
  "product_view",
  "product_viewed",
  "product_click",
  "product_search",
  "search",
  "wishlist_add",
  "cart_add",
  "add_to_cart",
  "purchase",
  "order_placed",
  "checkout_start",
  "ai_design_start",
  "ai_design_complete",
  "ai_product_select",
  "recommendation_click",
  "style_view",
  "store_view",
]);

export async function recordEvent(input: TrackedEventInput): Promise<TrackResult> {
  const eventType = String(input.eventType ?? "").slice(0, 80);
  const result: TrackResult = {
    recorded: false,
    eventId: null,
    eventType,
    dataState: "no_data",
    matchedWorkflows: [],
    storeMode: storeMode(),
  };
  if (!eventType) return result;

  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  const entityId = input.entityId ?? (typeof metadata.productId === "string" ? metadata.productId : null);
  const entityType = input.entityType ?? (entityId ? "product" : null);

  const store = await getStore();
  const eventId = await store.recordEvent({
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    anonymousId: input.anonymousId ?? null,
    eventType,
    entityType,
    entityId,
    path: input.path ?? null,
    metadata,
    device: input.device ?? null,
    platform: input.platform ?? null,
    createdAt: (input.occurredAt ?? new Date()).toISOString(),
  });

  result.recorded = Boolean(eventId);
  result.eventId = eventId;
  result.dataState = eventId ? "ok" : "degraded";

  // Long-term memory mirror (never blocks, never throws).
  if (input.userId && MEMORY_WORTHY.has(eventType)) {
    void customerMemory
      .remember(input.userId, {
        kind: "interaction",
        key: `${eventType}:${entityId ?? "unknown"}`,
        text: describeEvent(eventType, entityId, metadata),
        value: { eventType, entityType, entityId, path: input.path ?? null, metadata },
        importance: importanceOf(eventType),
        entityType: entityType ?? undefined,
        entityId: entityId ?? undefined,
        metadata,
      })
      .catch(() => undefined);
  }

  // Fire event-triggered workflows.
  const matched = await matchingWorkflows(eventType);
  result.matchedWorkflows = matched.map((w) => w.key);
  if (matched.length) {
    void runMatchedWorkflows(matched.map((w) => w.key), {
      eventType,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      entityId,
      entityType,
      metadata,
      occurredAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  return result;
}

export async function recordEvents(events: TrackedEventInput[]): Promise<TrackResult[]> {
  const out: TrackResult[] = [];
  for (const event of events) out.push(await recordEvent(event));
  return out;
}

/** Awaitable variant — used by tests and by the manual "run now" admin action. */
export async function runMatchedWorkflows(
  workflowKeys: string[],
  triggerPayload: Record<string, unknown>,
): Promise<{ key: string; ok: boolean; status?: string; error?: string }[]> {
  const results: { key: string; ok: boolean; status?: string; error?: string }[] = [];
  for (const key of workflowKeys) {
    try {
      const run = await executeWorkflowByKey(key, {
        triggerKind: "event",
        triggerPayload,
        userId: (triggerPayload.userId as string | null) ?? null,
        sessionId: (triggerPayload.sessionId as string | null) ?? null,
        actorRole: "system",
      });
      results.push({ key, ok: run.ok, status: run.status, error: run.error });
    } catch (error) {
      results.push({ key, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export async function matchingWorkflows(eventType: string) {
  const store = await getStore();
  const workflows = await store.listWorkflows();
  return workflows.filter((workflow) => {
    if (workflow.status !== "active") return false;
    if (workflow.triggerKind !== "event") return false;
    const types = (workflow.trigger?.eventTypes ?? []) as string[];
    return types.length === 0 ? false : types.includes(eventType) || types.includes("*");
  });
}

/** Aggregate event stats for the admin dashboard (no invented numbers). */
export async function eventStats(windowHours = 24) {
  const store = await getStore();
  const since = new Date(Date.now() - windowHours * 3600_000);
  const events = await store.listEvents({ since, limit: 1000 });
  const byType = new Map<string, number>();
  for (const event of events) byType.set(event.eventType, (byType.get(event.eventType) ?? 0) + 1);
  return {
    windowHours,
    total: events.length,
    uniqueUsers: new Set(events.map((e) => e.userId).filter(Boolean)).size,
    uniqueSessions: new Set(events.map((e) => e.sessionId ?? e.anonymousId).filter(Boolean)).size,
    byType: [...byType.entries()].map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count),
    lastEventAt: events[0]?.createdAt ?? null,
    dataState: events.length ? ("ok" as const) : ("no_data" as const),
  };
}

function importanceOf(eventType: string): number {
  if (["purchase", "order_placed"].includes(eventType)) return 0.95;
  if (["cart_add", "add_to_cart", "checkout_start"].includes(eventType)) return 0.8;
  if (["wishlist_add", "ai_design_complete", "ai_product_select"].includes(eventType)) return 0.7;
  if (["product_search", "search", "recommendation_click"].includes(eventType)) return 0.5;
  return 0.3;
}

function describeEvent(eventType: string, entityId: string | null, metadata: Record<string, unknown>): string {
  const bits = [eventType];
  if (entityId) bits.push(String(entityId).slice(0, 60));
  const extras = ["styleSlugs", "style", "category", "price", "query", "vendorId"]
    .map((key) => (metadata[key] !== undefined ? `${key}=${Array.isArray(metadata[key]) ? (metadata[key] as unknown[]).join("|") : String(metadata[key])}` : null))
    .filter(Boolean)
    .slice(0, 3);
  if (extras.length) bits.push(extras.join(", "));
  return bits.join(" · ").slice(0, 400);
}
