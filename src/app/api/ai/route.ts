import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/services/ai/provider";
import { mockAiProvider } from "@/services/ai/mockAiService";
import { sanitizeUserPrompt, ALL_ELEMENTS } from "@/services/ai/roomState";
import { understandIntent } from "@/services/ai/llm";
import { runDesignPipeline } from "@/services/ai/pipeline";
import type { GenerateDesignInput, ChatReplyInput } from "@/services/ai/types";
import type { IntentRequest } from "@/services/ai/llm/types";
import type { PipelineInput } from "@/services/ai/pipeline";
import { classifyAiError, toPublicAiError } from "@/services/ai/errors";
import { createRequestId, logAiRequest } from "@/services/ai/telemetry";
import { ApiError } from "@/lib/api/errors";
import { getClientIp, rateLimit } from "@/lib/api/rateLimit";
import { requireUser } from "@/lib/api/auth";

// ============================================================
// /api/ai — server AI gateway with security hardening.
//   • Input validation (action allowlist + payload size limit)
//   • Basic in-memory rate limiting (per IP)
//   • Per-request id (Phase 20 — observability)
//   • Duplicate-request protection (Phase 19 — no double generation)
//   • Standardized AI error codes (Phase 18 — no stack traces)
//   • Provider resolved per request (Mock default · Gemini-ready)
//   • Image actions degrade gracefully to Mock on failure
//   • No keys, providers, or model names reach the client
// ============================================================

const VALID_ACTIONS = new Set(["generate", "edit", "inpaint", "chat", "suggest", "analyze", "recommend", "understand", "pipeline", "resolve-sku", "match-products", "agent", "agent-status", "advice"]);
const IMAGE_ACTIONS = new Set(["generate", "edit", "inpaint"]);
/** Actions that run an image generation — protected against duplicates. */
const GENERATIVE_ACTIONS = new Set([...IMAGE_ACTIONS, "pipeline"]);
const MAX_PAYLOAD_BYTES = 15 * 1024 * 1024; // 15 MB (image base64 can be large)

// ---- Duplicate-request protection (Phase 19) ----
// If the SAME generative request arrives twice (double-click / retry),
// the second caller joins the first in-flight result instead of
// spawning a second generation.
const inflight = new Map<string, Promise<NextResponse>>();

/** djb2 — stable 32-bit hash (no crypto needed for dedupe keys). */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function dedupeKey(action: string, payload: Record<string, unknown>): string {
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const img = typeof payload.referenceImage === "string" ? payload.referenceImage.slice(0, 80) : "";
  const mask = typeof payload.mask === "string" ? payload.mask.slice(0, 80) : "";
  return `${action}:${hashString(prompt)}:${hashString(img)}:${hashString(mask)}`;
}

function json(data: Record<string, unknown>, status: number, requestId: string): NextResponse {
  return NextResponse.json({ ...data, _requestId: requestId }, { status });
}

async function dispatch(provider: typeof mockAiProvider, action: string, payload: GenerateDesignInput | ChatReplyInput | { room: string; style: string; budget?: string }) {
  switch (action) {
    case "generate": return provider.generateDesign(payload as GenerateDesignInput);
    case "edit": return provider.editImage(payload as GenerateDesignInput);
    case "inpaint": return provider.inpaint(payload as GenerateDesignInput);
    case "chat": return provider.chat(payload as ChatReplyInput);
    case "suggest": return provider.suggestDecor(payload as { room: string; style: string; budget?: string });
    case "analyze": return provider.analyzeRoom(payload as GenerateDesignInput);
    case "recommend": return provider.recommendProducts(payload as GenerateDesignInput);
    default: throw new Error("Unknown action");
  }
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const finish = (status: "ok" | "degraded" | "error", extra?: { provider?: string; action?: string; errorCode?: string }) => {
    logAiRequest({
      requestId,
      userId: null,
      action: extra?.action ?? "unknown",
      provider: extra?.provider ?? "gateway",
      durationMs: Date.now() - startedAt,
      status,
      errorCode: extra?.errorCode,
    });
  };

  try {
    // ---- Rate limiting (shared in-memory limiter) ----
    try {
      rateLimit(`ai:${getClientIp(req)}`, { windowMs: 60_000, max: 30 });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        finish("error", { errorCode: "RATE_LIMIT" });
        return json({ error: "تعداد درخواست‌ها زیاد است — کمی صبر کن", code: "RATE_LIMIT" }, 429, requestId);
      }
      throw err;
    }

    // ---- Payload size guard ----
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
      finish("error", { errorCode: "INVALID_REQUEST" });
      return json({ error: "حجم درخواست بیش از حد مجاز", code: "INVALID_REQUEST" }, 413, requestId);
    }

    const raw = await req.text();

    // ---- Parse + validate JSON ----
    let body: { action?: unknown; payload?: unknown };
    try { body = JSON.parse(raw); }
    catch {
      finish("error", { errorCode: "INVALID_REQUEST" });
      return json({ error: "JSON نامعتبر", code: "INVALID_REQUEST" }, 400, requestId);
    }

    const action = typeof body.action === "string" ? body.action : "";
    if (!VALID_ACTIONS.has(action)) {
      finish("error", { errorCode: "INVALID_REQUEST", action });
      return json({ error: "action نامعتبر", code: "INVALID_REQUEST" }, 400, requestId);
    }

    const payload = body.payload;
    if (!payload || typeof payload !== "object") {
      finish("error", { errorCode: "INVALID_REQUEST", action });
      return json({ error: "payload نامعتبر", code: "INVALID_REQUEST" }, 400, requestId);
    }

    // ---- Sanitize string fields (anti-injection + XSS prevention) ----
    const p = payload as Record<string, unknown>;
    // Never trust a client-supplied userId. When server-side credits are on,
    // identity comes only from the authenticated session.
    delete p.userId;
    // Real (paid) providers configured → generative actions MUST be
    // authenticated. Sample/demo mode (no keys) stays open and free.
    const hasRealProvider = Boolean(
      process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.LLM_BASE_URL ||
        process.env.FREELLM_API_URL ||
        process.env.ORALI_API_URL,
    );
    const AUTH_REQUIRED_ACTIONS = new Set(["generate", "edit", "inpaint", "pipeline"]);
    if (process.env.AI_SERVER_CREDITS === "1" || (hasRealProvider && AUTH_REQUIRED_ACTIONS.has(action))) {
      try {
        const ctx = await requireUser(req);
        p.userId = ctx.user.id;
        // Authenticated identity is a far better limiter key than a
        // spoofable X-Forwarded-For header.
        rateLimit(`ai:user:${ctx.user.id}`, { windowMs: 60_000, max: 20 });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 401;
        finish("error", { errorCode: "UNAUTHORIZED", action });
        return json({ error: "برای این عملیات باید وارد شوید", code: "UNAUTHORIZED" }, status, requestId);
      }
    }
    for (const key of ["prompt", "message"]) {
      if (key in p && typeof p[key] === "string") {
        p[key] = sanitizeUserPrompt(p[key] as string);
      }
    }
    for (const key of ["style", "room", "color", "mood", "sku", "productCode", "productId", "previousProductId", "previousSKU", "sessionId", "agentKey", "scenario", "slug", "topic"]) {
      if (key in p && typeof p[key] === "string") {
        p[key] = (p[key] as string).replace(/<[^>]+>/g, "").slice(0, 200);
      }
    }
    // ---- Pipeline payloads: clamp enum arrays to the element vocabulary ----
    const VALID_ELEMENTS = new Set(ALL_ELEMENTS as string[]);
    for (const key of ["targets", "preservedExtra", "selectedTargets", "previousTargets"]) {
      if (key in p && Array.isArray(p[key])) {
        p[key] = (p[key] as unknown[]).filter((x): x is string => typeof x === "string" && VALID_ELEMENTS.has(x)).slice(0, 16);
      }
    }
    if ("colors" in p && Array.isArray(p.colors)) {
      p.colors = (p.colors as unknown[]).filter((x): x is string => typeof x === "string").map((c) => c.replace(/<[^>]+>/g, "").slice(0, 40)).slice(0, 6);
    }

    // ---- Duplicate-request protection for generative actions ----
    if (GENERATIVE_ACTIONS.has(action)) {
      const key = dedupeKey(action, p);
      const existing = inflight.get(key);
      if (existing) {
        // Join the in-flight result — no second generation is started.
        const res = await existing;
        const body = await res.clone().json().catch(() => ({}));
        finish("ok", { action, provider: "dedupe-join" });
        return json({ ...body, _deduped: true }, res.status, requestId);
      }
      const run = handleAction(action, p, requestId).finally(() => {
        // Keep the dedupe key briefly so a fast retry after completion
        // does not double-run; then release.
        setTimeout(() => inflight.delete(key), 5_000);
      });
      inflight.set(key, run);
      return run;
    }

    return handleAction(action, p, requestId);
  } catch (err) {
    const pub = toPublicAiError(err, requestId);
    finish("error", { errorCode: pub.code });
    return json({ error: pub.message, code: pub.code }, classifyAiError(err).status, requestId);
  }
}

/** Run one validated action and produce its HTTP response. */
async function handleAction(action: string, p: Record<string, unknown>, requestId: string): Promise<NextResponse> {
  const startedAt = Date.now();
  const finish = (status: "ok" | "degraded" | "error", extra?: { provider?: string; errorCode?: string }) => {
    logAiRequest({
      requestId,
      userId: null,
      action,
      provider: extra?.provider ?? "gateway",
      durationMs: Date.now() - startedAt,
      status,
      errorCode: extra?.errorCode,
    });
  };

  try {
    // ---- Agentic actions: routed through Homeino's own orchestrator ----
    if (action === "agent-status") {
      const { orchestratorStatus } = await import("@/services/agents/orchestrator");
      const status = await orchestratorStatus();
      finish("ok", { provider: "orchestrator" });
      return json({ status }, 200, requestId);
    }
    if (action === "agent") {
      const { routeIntent } = await import("@/services/agents/orchestrator");
      const message = typeof p.message === "string" ? p.message : typeof p.prompt === "string" ? p.prompt : "";
      if (!message.trim()) {
        finish("error", { errorCode: "INVALID_REQUEST" });
        return json({ error: "پیامی ارسال نشد", code: "INVALID_REQUEST" }, 400, requestId);
      }
      const history = Array.isArray(p.history)
        ? (p.history as unknown[])
            .filter((h): h is { role?: unknown; content?: unknown } => Boolean(h) && typeof h === "object")
            .map((h): { role: "user" | "assistant"; content: string } => ({
              role: h.role === "user" || h.role === "assistant" ? h.role : "user",
              content: String(h.content ?? "").replace(/<[^>]+>/g, "").slice(0, 400),
            }))
            .slice(-8)
        : [];
      const routed = await routeIntent({
        message: message.slice(0, 1000),
        userId: typeof p.userId === "string" ? p.userId : null,
        sessionId: typeof p.sessionId === "string" ? p.sessionId : null,
        agentKey: typeof p.agentKey === "string" && p.agentKey ? p.agentKey : undefined,
        history,
        context: typeof p.context === "string" ? p.context.slice(0, 300) : undefined,
      });
      finish(routed.ok ? "ok" : "degraded", { provider: "orchestrator" });
      // `content` keeps the existing ChatReply contract — real products are
      // attached separately and are always catalog-verified.
      return json(
        {
          content: routed.message,
          products: routed.products,
          understanding: routed.understanding,
          routedTo: routed.routedTo,
          intent: routed.intent,
          dataState: routed.dataState,
          agentOk: routed.ok,
          agentError: routed.error ?? null,
        },
        200,
        requestId,
      );
    }

    // ---- Pipeline actions: LLM Service + Orali pipeline (provider-agnostic) ----
    if (action === "resolve-sku") {
      // DB-backed: matches sku OR id OR slug in the live catalog (Supabase),
      // falling back to the shipped mock catalog when the DB is absent.
      const code = typeof p.code === "string" ? p.code : typeof p.sku === "string" ? p.sku : "";
      const { productsRepository } = await import("@/repositories");
      const product = code.trim() ? await productsRepository.bySku(code) : undefined;
      if (!product) {
        return json({ error: "این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید.", code: "INVALID_SKU" }, 404, requestId);
      }
      return json({ product }, 200, requestId);
    }
    if (action === "match-products") {
      // The matcher accepts an injectable catalog — feed it the LIVE database
      // pool (mock catalog when the DB is absent) instead of static rows.
      const { matchStoreProducts } = await import("@/services/ai/roomState");
      const { productsRepository } = await import("@/repositories");
      const catalog = await productsRepository.list();
      const matches = matchStoreProducts({ ...(p as Record<string, unknown>), catalog } as never);
      return json({ products: matches }, 200, requestId);
    }
    if (action === "advice") {
      // DB-backed PDP quick questions (pair / color / style) — the live
      // catalog twin of the client-side static fallback.
      const { resolveProductAdvice } = await import("@/services/ai/productAdviceServer");
      const topic = typeof p.topic === "string" ? p.topic : "";
      const slug = typeof p.slug === "string" ? p.slug : "";
      try {
        const advice = await resolveProductAdvice(topic, slug);
        finish(advice ? "ok" : "degraded", { provider: "product-advice" });
        return json({ advice }, 200, requestId);
      } catch {
        // Never fail the panel: advice:null → client falls back to static.
        finish("degraded", { provider: "product-advice", errorCode: "ADVICE_UNAVAILABLE" });
        return json({ advice: null }, 200, requestId);
      }
    }
    if (action === "understand") {
      const { analysis, source, degraded } = await understandIntent(p as unknown as IntentRequest);
      finish(degraded ? "degraded" : "ok", { provider: source });
      return json({ ...analysis, _llm: source, _degraded: degraded }, 200, requestId);
    }
    if (action === "pipeline") {
      const result = await runDesignPipeline(p as unknown as PipelineInput);
      finish("ok", { provider: "pipeline" });
      return json({ ...result, _pipeline: true }, 200, requestId);
    }

    // ---- Resolve provider + dispatch ----
    const { provider, name } = await resolveProvider();
    try {
      const result = await dispatch(provider, action, p as never);
      finish("ok", { provider: name });
      return json({ ...(result as unknown as Record<string, unknown>), _provider: name }, 200, requestId);
    } catch (err) {
      if (IMAGE_ACTIONS.has(action)) {
        // Honest degradation: mock marks the result as preview — never fake success.
        const fallback = await dispatch(mockAiProvider, action, p as never);
        finish("degraded", { provider: "mock", errorCode: classifyAiError(err).code });
        return json({ ...(fallback as unknown as Record<string, unknown>), _provider: "mock", _degraded: true }, 200, requestId);
      }
      throw err;
    }
  } catch (err) {
    const pub = toPublicAiError(err, requestId);
    finish("error", { errorCode: pub.code });
    return json({ error: pub.message, code: pub.code }, classifyAiError(err).status, requestId);
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
