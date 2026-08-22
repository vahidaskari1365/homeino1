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

const VALID_ACTIONS = new Set(["generate", "edit", "inpaint", "chat", "suggest", "analyze", "recommend", "understand", "pipeline"]);
const IMAGE_ACTIONS = new Set(["generate", "edit", "inpaint"]);
/** Actions that run an image generation — protected against duplicates. */
const GENERATIVE_ACTIONS = new Set([...IMAGE_ACTIONS, "pipeline"]);
const MAX_PAYLOAD_BYTES = 15 * 1024 * 1024; // 15 MB (image base64 can be large)

// ---- Simple in-memory rate limiter (per IP, resets every minute) ----
const RATE_WINDOW = 60_000;
const RATE_MAX = 30; // 30 requests per minute per IP
const ipHits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

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
    // ---- Rate limiting ----
    const ip = getClientIp(req);
    if (rateLimited(ip)) {
      finish("error", { errorCode: "RATE_LIMIT" });
      return json({ error: "تعداد درخواست‌ها زیاد است — کمی صبر کن", code: "RATE_LIMIT" }, 429, requestId);
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
    // Server-side credits are opt-in (AI_SERVER_CREDITS=1) and must be wired
    // to real auth before trusting a client-supplied userId.
    if (process.env.AI_SERVER_CREDITS !== "1") {
      delete p.userId;
    }
    for (const key of ["prompt", "message"]) {
      if (key in p && typeof p[key] === "string") {
        p[key] = sanitizeUserPrompt(p[key] as string);
      }
    }
    for (const key of ["style", "room", "color", "mood"]) {
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
    // ---- Pipeline actions: LLM Service + Orali pipeline (provider-agnostic) ----
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
