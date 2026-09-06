// ============================================================
// /api/analytics — server-side behavior tracking
//
// POST  { event } | { events: [...] }  → analytics_events (DB when configured)
//       and fires every active event-triggered workflow.
// GET   (admin)                        → aggregated stats for the dashboard
//
// Identity is resolved from the session — a client-supplied userId is ignored.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { getClientIp, rateLimit } from "@/lib/api/rateLimit";
import { optionalUser, requireAdminUser } from "@/lib/api/auth";
import { recordEvent, eventStats, KNOWN_EVENT_TYPES } from "@/services/workflows/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 20;
const MAX_METADATA_BYTES = 8_000;

function sanitizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const out: Record<string, unknown> = {};
  let size = 0;
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (size > MAX_METADATA_BYTES) break;
    if (/password|token|secret|authorization|card|cvv/i.test(key)) continue;
    if (typeof value === "string") {
      const trimmed = value.slice(0, 500);
      out[key.slice(0, 60)] = trimmed;
      size += trimmed.length;
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key.slice(0, 60)] = value;
      size += 8;
    } else if (Array.isArray(value)) {
      const list = value.slice(0, 10).filter((v) => typeof v === "string" || typeof v === "number").map(String);
      out[key.slice(0, 60)] = list;
      size += list.join("").length;
    }
  }
  return out;
}

function readEvent(raw: unknown, identity: { userId: string | null }, req: Request) {
  if (!raw || typeof raw !== "object") throw ApiError.badRequest("رویداد نامعتبر است");
  const source = raw as Record<string, unknown>;
  const eventType = String(source.eventType ?? source.event_type ?? "").trim().slice(0, 60);
  if (!eventType) throw ApiError.badRequest("eventType الزامی است");
  const str = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
  return {
    userId: identity.userId,
    sessionId: str(source.sessionId ?? source.session_id, 80),
    anonymousId: str(source.anonymousId ?? source.anonymous_id, 80),
    eventType,
    entityType: str(source.entityType ?? source.entity_type, 40),
    entityId: str(source.entityId ?? source.entity_id, 120),
    path: str(source.path ?? req.headers.get("referer"), 300),
    device: str(source.device, 30),
    platform: str(source.platform, 30),
    metadata: sanitizeMetadata(source.metadata),
  };
}

export const POST = guard(async (req) => {
  await rateLimit(`analytics:${getClientIp(req)}`, { windowMs: 60_000, max: 240 });
  const identity = await optionalUser(req);
  const body = await readBody(req, 200_000);
  const payload = body as Record<string, unknown>;

  const rawEvents = Array.isArray(payload.events) ? payload.events : payload.event ? [payload.event] : [payload];
  if (!rawEvents.length) throw ApiError.badRequest("هیچ رویدادی ارسال نشد");
  if (rawEvents.length > MAX_BATCH) throw ApiError.badRequest(`حداکثر ${MAX_BATCH} رویداد در هر درخواست`);

  const results = [];
  const matched = new Set<string>();
  for (const raw of rawEvents) {
    const event = readEvent(raw, identity, req);
    const result = await recordEvent(event);
    results.push({ eventType: event.eventType, recorded: result.recorded, dataState: result.dataState });
    for (const key of result.matchedWorkflows) matched.add(key);
  }

  return ok({
    recorded: results.filter((r) => r.recorded).length,
    total: results.length,
    events: results,
    matchedWorkflows: [...matched],
    dataState: results.some((r) => r.recorded) ? "ok" : "degraded",
  });
});

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const windowHours = Math.min(720, Math.max(1, Number(url.searchParams.get("windowHours") ?? 24) || 24));
  const stats = await eventStats(windowHours);
  return ok({ ...stats, knownEventTypes: KNOWN_EVENT_TYPES });
});
