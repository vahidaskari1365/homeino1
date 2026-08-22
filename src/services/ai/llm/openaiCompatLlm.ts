// ============================================================
// OpenAI-Compatible LLM Provider — SERVER-ONLY.
// Works with ANY OpenAI-style /chat/completions endpoint
// (FreeLLMAPI, OpenRouter, vLLM, OpenAI, …). Configured purely
// via env — swapping providers never touches the UI:
//
//   LLM_API_BASE_URL  e.g. https://api.freellmapi.com/v1
//   LLM_API_KEY
//   LLM_MODEL         e.g. glm-4.7-flash
//
// OUTPUT CONTRACT: tiny, structured JSON only.
//   max_tokens ≤ 220 · temperature 0.2 · no prose, no chat.
//
// HARDENING (Phase 13): every answer is schema-validated; invalid
// answers get a BOUNDED retry (max 3) with a corrective hint fed
// back to the model — infinite retry is forbidden.
// ============================================================
import type { IntentRequest, IntentAnalysis, LlmProvider } from "./types";
import { ALL_ELEMENTS, type RoomElement } from "../roomState";
import { heuristicUnderstandIntent } from "./heuristicLlm";
import { extractJsonPayload, validateIntentPayload, withBoundedRetry } from "../validation";
import type { EditScope } from "../scope";

const BASE = () => (process.env.LLM_API_BASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.LLM_API_KEY || "";
const MODEL = () => process.env.LLM_MODEL || "auto";

export const isOpenAiCompatConfigured = (): boolean => Boolean(BASE() && KEY());

const SYSTEM_PROMPT = `You are the intent-analysis module of Homeino, an interior-design AI.
Your ONLY job: convert the user's (Persian) request into a tiny JSON object. Never chat. Never explain.

Return EXACTLY this JSON shape and nothing else:
{"intent":"targeted_edit|full_redesign|color_change|add_item|remove_item|inquiry","target":["sofa"],"changes":["short phrase"],"preservedElements":["wall","floor"],"scope":"single_item|area|room|whole_home","style":"modern","colors":["کرم"],"confidence":0.9}

Element vocabulary (the ONLY allowed target/preservedElements values):
sofa, rug, curtain, lighting, wall, floor, ceiling, table, chair, tv, plant, art, door, window, shelf, bed

SCOPE RULES (very important — never widen without permission):
- "مبل را عوض کن" → scope single_item, target ONLY ["sofa"]. Everything else goes to preservedElements.
- "فضای نشیمن را مدرن‌تر کن" → scope area.
- "کل اتاق را ژاپندی کن" → scope room.
- "کل خانه را از اول طراحی کن" → scope whole_home, target = all elements, preservedElements = [].
- "این اتاق را مدرن کن" (broad) → scope room.
- A request with a single object + a color («مبل را کرم کن») is single_item color_change, NOT a full redesign.

PRESERVATION RULES:
- preservedElements must ALWAYS include walls, floor, windows, doors, ceiling unless scope is room/whole_home.
- If the user only mentions one object, every other object in the room must be preserved.

CONTINUATION (previous request exists): if the new prompt refers to the previous target with pronouns («کمی روشن‌ترش کن», «آن را کوچک‌تر کن», «همین را») and names NO new element, target = the previous target and scope = single_item.

- changes: max 3 short phrases. No long text. JSON only.
- If the request is unclear → intent inquiry, ambiguous, confidence < 0.5.`;

/** Serialize the user turn — only the fields this request needs (Phase 12). */
function buildUserMessage(req: IntentRequest): string {
  const core: Record<string, unknown> = {
    prompt: req.prompt,
  };
  if (req.style) core.style = req.style;
  if (req.room) core.room = req.room;
  if (req.colors?.length) core.colors = req.colors;
  if (req.changeScope) core.changeScope = req.changeScope;
  if (req.selectedTargets?.length) core.selectedTargets = req.selectedTargets;
  if (req.previousTargets?.length) core.previousTargets = req.previousTargets;
  if (req.previousChanges?.length) core.previousChanges = req.previousChanges.slice(0, 2);
  if (req.roomContext) core.roomContext = req.roomContext;
  if (req.budget) core.budget = req.budget;
  return JSON.stringify(core);
}

async function callCompat(req: IntentRequest): Promise<IntentAnalysis> {
  const MAX_ATTEMPTS = 3; // bounded retry — never infinite (Phase 13)

  const result = await withBoundedRetry(
    async (attempt) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        let userContent = buildUserMessage(req);
        if (attempt > 0) {
          // Self-correction: tell the model exactly what it got wrong.
          userContent += `\n\nPrevious attempt returned invalid JSON. Return ONLY the exact JSON object with the exact keys listed in the system prompt. No markdown, no comments.`;
        }
        const res = await fetch(`${BASE()}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY()}` },
          body: JSON.stringify({
            model: MODEL(),
            temperature: 0.2,
            max_tokens: 220, // HARD CAP — intent analysis must stay tiny
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          }),
        });
        if (!res.ok) throw new Error(`llm_http_${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw: string = data?.choices?.[0]?.message?.content ?? "";
        const parsed = extractJsonPayload(raw);
        if (parsed === null) throw new Error("llm_no_json");
        const problems = validateIntentPayload(parsed);
        if (problems.length > 0) throw new Error(`llm_invalid_schema:${problems.join(",")}`);
        return normalizeIntentAnalysis(parsed, req);
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      attempts: MAX_ATTEMPTS,
      shouldRetry: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        // Retry network/5xx failures AND invalid JSON — both are transient
        // for a bounded number of attempts. Non-200 HTTP is NOT retried
        // (auth/endpoint problems won't fix themselves).
        const name = (err as { name?: string })?.name;
        return /llm_no_json|llm_invalid_schema/.test(msg) || /llm_http_5\d\d/.test(msg) || name === "AbortError";
      },
      delayMs: (attempt) => 300 * (attempt + 1),
    },
  );

  if (!result.ok) {
    const err = result.error;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "llm_no_json" || msg.startsWith("llm_invalid_schema")) {
      // Model is not following the contract → fall back to the
      // deterministic engine instead of returning garbage (Phase 14).
      const fb = heuristicUnderstandIntent(req);
      return { ...fb, confidence: Math.min(fb.confidence, 0.55), ambiguous: true, note: "مدل خارجی پاسخ نامعتبر داد — از موتور داخلی استفاده شد." };
    }
    throw err;
  }
  return result.value as IntentAnalysis;
}

/** Clamp / validate the LLM answer against the contract — never trust it blindly. */
export function normalizeIntentAnalysis(raw: unknown, req: IntentRequest): IntentAnalysis {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const validElements = (v: unknown): RoomElement[] =>
    Array.isArray(v) ? v.filter((x): x is RoomElement => typeof x === "string" && (ALL_ELEMENTS as string[]).includes(x)) : [];

  const target = validElements(obj.target);
  const preserved = validElements(obj.preservedElements).filter((e) => !target.includes(e));
  const intent = ["targeted_edit", "full_redesign", "color_change", "add_item", "remove_item", "inquiry"].includes(String(obj.intent))
    ? (String(obj.intent) as IntentAnalysis["intent"])
    : "inquiry";
  const confidence = Math.min(1, Math.max(0, Number(obj.confidence) || 0));
  const colors = Array.isArray(obj.colors) ? obj.colors.filter((c): c is string => typeof c === "string").slice(0, 5) : undefined;
  const style = typeof obj.style === "string" ? obj.style : undefined;
  const scope = ["single_item", "area", "room", "whole_home"].includes(String(obj.scope))
    ? (String(obj.scope) as EditScope)
    : undefined;

  if (intent === "inquiry" || target.length === 0) {
    // Invalid/empty reading → fall back to the deterministic engine.
    const fb = heuristicUnderstandIntent(req);
    return fb.confidence >= confidence ? fb : { ...fb, confidence };
  }

  const isFull = intent === "full_redesign";
  return {
    intent,
    target: isFull ? [...ALL_ELEMENTS] : target,
    changes: Array.isArray(obj.changes) ? obj.changes.filter((c): c is string => typeof c === "string").slice(0, 3) : [req.prompt.slice(0, 60)],
    preservedElements: isFull ? [] : (preserved.length ? preserved : ALL_ELEMENTS.filter((e) => !target.includes(e))),
    scope,
    style: style || req.style,
    colors: colors?.length ? colors : req.colors,
    confidence,
  };
}

export const openAiCompatLlmProvider: LlmProvider = {
  name: "openai-compat",
  async understandIntent(req) {
    if (!isOpenAiCompatConfigured()) throw new Error("llm_not_configured");
    return callCompat(req);
  },
};
