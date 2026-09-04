// ============================================================
// /api/recommendations — real products only
//
// GET    read what the recommendation agent persisted (or generate on demand)
// POST   force a fresh agent run for the caller's own profile
// DELETE dismiss / mark converted (feeds memory + the next run)
//
// Every item is a real catalog product; when there is no behavioral evidence
// the response says so (`dataState: "no_data"`) instead of inventing products.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { optionalUser } from "@/lib/api/auth";
import { getStoredRecommendations, recordRecommendationFeedback } from "@/services/recommendations/recommendationEngine";
import { publicProduct } from "@/services/agents/tools";
import { runAgentByKey } from "@/services/agents/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCENARIOS = new Set(["home", "product_detail", "store", "cart", "wishlist", "search", "account", "ai_designer", "similar"]);

function readScenario(value: unknown): string {
  const scenario = String(value ?? "home").slice(0, 40);
  return SCENARIOS.has(scenario) ? scenario : "home";
}

function readLimit(value: unknown, fallback = 12): number {
  const limit = Number(value ?? fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(40, Math.max(1, Math.round(limit)));
}

function sessionIdOf(req: Request, explicit?: unknown): string | null {
  const fromQuery = typeof explicit === "string" && explicit.trim() ? explicit.trim().slice(0, 80) : null;
  if (fromQuery) return fromQuery;
  const cookie = req.headers.get("cookie") ?? "";
  const match = /homeino_session_id=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]).slice(0, 80) : null;
}

async function agentRecommendations(options: {
  scenario: string;
  limit: number;
  userId: string | null;
  sessionId: string | null;
  seedProductId?: string | null;
  recompute?: boolean;
}) {
  const run = await runAgentByKey("recommendation", {
    input: {
      scenario: options.scenario,
      limit: options.limit,
      seedProductId: options.seedProductId ?? null,
      recompute: Boolean(options.recompute),
    },
    userId: options.userId,
    sessionId: options.sessionId,
    triggeredBy: "api:recommendations",
  });
  const output = (run.output ?? {}) as Record<string, unknown>;
  const items = Array.isArray(output.items) ? (output.items as Record<string, unknown>[]) : [];
  return {
    items,
    count: items.length,
    dataState: (run.dataState ?? (items.length ? "ok" : "no_data")) as "ok" | "no_data" | "not_enough_data" | "degraded",
    scenario: options.scenario,
    source: String(output.source ?? "agent"),
    persisted: Number(output.persisted ?? 0),
    profileConfidence: Number(output.profileConfidence ?? 0),
    honestNote: typeof output.honestNote === "string" ? output.honestNote : undefined,
    agentRunId: run.agentRunId ?? null,
    ok: run.ok,
    error: run.error ?? null,
  };
}

export const GET = guard(async (req) => {
  const identity = await optionalUser(req);
  rateLimit(`recommendations:${identity.userId ?? clientIp(req)}`, { windowMs: 60_000, max: 60 });

  const url = new URL(req.url);
  const scenario = readScenario(url.searchParams.get("scenario"));
  const limit = readLimit(url.searchParams.get("limit"));
  const sessionId = sessionIdOf(req, url.searchParams.get("sessionId"));
  const seedProductId = url.searchParams.get("seedProductId")?.slice(0, 64) ?? null;
  const fresh = url.searchParams.get("fresh") === "true" || url.searchParams.get("recompute") === "true";

  if (!identity.userId && !sessionId) {
    // No identity at all — be honest instead of showing random products.
    return ok({ items: [], count: 0, dataState: "no_data", scenario, source: "none", reason: "no_identity" });
  }

  if (!fresh) {
    const stored = await getStoredRecommendations({ userId: identity.userId, sessionId, scenario, limit });
    if (stored.items.length) {
      return ok({
        items: stored.items.map((item) => ({ ...publicProduct(item.product), score: item.score, rank: item.rank, reasonCode: item.reasonCode, reasonText: item.reasonText, recommendationId: item.recommendationId ?? null })),
        count: stored.items.length,
        dataState: stored.dataState,
        scenario: stored.scenario,
        source: "stored",
      });
    }
  }

  const generated = await agentRecommendations({ scenario, limit, userId: identity.userId, sessionId, seedProductId });
  return ok(generated);
});

export const POST = guard(async (req) => {
  const identity = await optionalUser(req);
  rateLimit(`recommendations:write:${identity.userId ?? clientIp(req)}`, { windowMs: 60_000, max: 20 });
  const body = (await readBody(req, 50_000)) as Record<string, unknown>;

  const scenario = readScenario(body.scenario);
  const limit = readLimit(body.limit);
  const sessionId = sessionIdOf(req, body.sessionId);
  const seedProductId = typeof body.seedProductId === "string" ? body.seedProductId.slice(0, 64) : null;

  if (!identity.userId && !sessionId) throw ApiError.badRequest("برای ساخت پیشنهاد به شناسه کاربری یا نشست نیاز است");

  const result = await agentRecommendations({ scenario, limit, userId: identity.userId, sessionId, seedProductId, recompute: body.recompute !== false });
  if (!result.ok && !result.items.length) throw ApiError.badRequest(result.error ?? "ساخت پیشنهاد ناموفق بود");
  return ok(result);
});

export const DELETE = guard(async (req) => {
  const identity = await optionalUser(req);
  const body = (await readBody(req, 20_000)) as Record<string, unknown>;
  const recommendationId = typeof body.recommendationId === "string" ? body.recommendationId.slice(0, 64) : undefined;
  const productId = typeof body.productId === "string" ? body.productId.slice(0, 64) : undefined;
  const action = body.action === "convert" ? "convert" : body.action === "click" ? "click" : "dismiss";
  if (!recommendationId && !productId) throw ApiError.badRequest("recommendationId یا productId الزامی است");

  const result = await recordRecommendationFeedback({
    recommendationId,
    productId,
    userId: identity.userId,
    sessionId: sessionIdOf(req, body.sessionId),
    scenario: readScenario(body.scenario),
    action,
  });
  return ok({ ...result, action });
});

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
