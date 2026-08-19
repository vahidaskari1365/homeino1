import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/services/ai/provider";
import { mockAiProvider } from "@/services/ai/mockAiService";
import { sanitizeUserPrompt, ALL_ELEMENTS } from "@/services/ai/roomState";
import { understandIntent } from "@/services/ai/llm";
import { runDesignPipeline } from "@/services/ai/pipeline";
import type { GenerateDesignInput, ChatReplyInput } from "@/services/ai/types";
import type { IntentRequest } from "@/services/ai/llm/types";
import type { PipelineInput } from "@/services/ai/pipeline";

// ============================================================
// /api/ai — server AI gateway with security hardening.
//   • Input validation (action allowlist + payload size limit)
//   • Basic in-memory rate limiting (per IP)
//   • Provider resolved per request (Mock default · Gemini-ready)
//   • Image actions degrade gracefully to Mock on failure
//   • No keys, providers, or model names reach the client
// ============================================================

const VALID_ACTIONS = new Set(["generate", "edit", "inpaint", "chat", "suggest", "analyze", "recommend", "understand", "pipeline"]);
const IMAGE_ACTIONS = new Set(["generate", "edit", "inpaint"]);
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
  try {
    // ---- Rate limiting ----
    const ip = getClientIp(req);
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "تعداد درخواست‌ها زیاد است — کمی صبر کن" }, { status: 429 });
    }

    // ---- Payload size guard ----
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "حجم درخواست بیش از حد مجاز" }, { status: 413 });
    }

    const raw = await req.text();

    // ---- Parse + validate JSON ----
    let body: { action?: unknown; payload?: unknown };
    try { body = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "JSON نامعتبر" }, { status: 400 }); }

    const action = typeof body.action === "string" ? body.action : "";
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: "action نامعتبر" }, { status: 400 });
    }

    const payload = body.payload;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "payload نامعتبر" }, { status: 400 });
    }

    // ---- Sanitize string fields (anti-injection + XSS prevention) ----
    const p = payload as Record<string, unknown>;
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
    for (const key of ["targets", "preservedExtra", "selectedTargets"]) {
      if (key in p && Array.isArray(p[key])) {
        p[key] = (p[key] as unknown[]).filter((x): x is string => typeof x === "string" && VALID_ELEMENTS.has(x)).slice(0, 16);
      }
    }
    if ("colors" in p && Array.isArray(p.colors)) {
      p.colors = (p.colors as unknown[]).filter((x): x is string => typeof x === "string").map((c) => c.replace(/<[^>]+>/g, "").slice(0, 40)).slice(0, 6);
    }

    // ---- Pipeline actions: LLM Service + Orali pipeline (provider-agnostic) ----
    if (action === "understand") {
      const { analysis, source, degraded } = await understandIntent(p as unknown as IntentRequest);
      return NextResponse.json({ ...analysis, _llm: source, _degraded: degraded });
    }
    if (action === "pipeline") {
      try {
        const result = await runDesignPipeline(p as unknown as PipelineInput);
        return NextResponse.json({ ...result, _pipeline: true });
      } catch {
        // Honest failure — no fake success, no silent mock substitution.
        return NextResponse.json({ error: "PIPELINE_FAILED" }, { status: 502 });
      }
    }

    // ---- Resolve provider + dispatch ----
    const { provider, name } = await resolveProvider();
    try {
      const result = await dispatch(provider, action, p as never);
      return NextResponse.json({ ...result, _provider: name });
    } catch (err) {
      if (IMAGE_ACTIONS.has(action)) {
        const fallback = await dispatch(mockAiProvider, action, p as never);
        return NextResponse.json({ ...fallback, _provider: "mock", _degraded: true });
      }
      throw err;
    }
  } catch {
    // Never leak internal error details
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
