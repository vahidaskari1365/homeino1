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
import {
  ALL_ELEMENTS,
  STRUCTURAL_ELEMENTS,
  detectArchitecturalTargets,
  type RoomElement,
} from "../roomState";
import { heuristicUnderstandIntent } from "./heuristicLlm";
import { extractJsonPayload, validateIntentPayload, withBoundedRetry } from "../validation";
import { resolveScope } from "../scope";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "./systemPrompt";

const BASE = () => (process.env.LLM_API_BASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.LLM_API_KEY || "";
const MODEL = () => process.env.LLM_MODEL || "auto";

export const isOpenAiCompatConfigured = (): boolean => Boolean(BASE() && KEY());

/** Final Homeino Interior Design Intelligence system prompt (see systemPrompt.ts). */
const SYSTEM_PROMPT = HOMEINO_SYSTEM_PROMPT;

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
          // Self-correction: tell the model exactly what it got wrong (bounded retry).
          userContent += `\n\n${HOMEINO_RETRY_HINT}`;
        }
        const res = await fetch(`${BASE()}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY()}` },
          body: JSON.stringify({
            model: MODEL(),
            temperature: 0.2,
            max_tokens: 280, // structured intent JSON — still capped, room for full preservedElements lists
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

/**
 * Clamp / validate the LLM answer against the contract — NEVER trust it
 * blindly (fix 8).
 *
 * Pipeline: LLM → normalize → scope resolver → target resolver →
 * structural protection → validation. The canonical decision tree
 * (scope.ts / resolveScope) is the SINGLE authority for scope & targets:
 *   • the LLM's scope is ignored — the tree's scope wins
 *   • the LLM may only NARROW targets within what the tree allows
 *   • structural elements are targeted only on explicit user request
 *   • an over-broad LLM answer (e.g. target=all_elements when the user
 *     only asked for the sofa) is normalized down to the user's target
 */
export function normalizeIntentAnalysis(raw: unknown, req: IntentRequest): IntentAnalysis {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const validElements = (v: unknown): RoomElement[] =>
    Array.isArray(v) ? v.filter((x): x is RoomElement => typeof x === "string" && (ALL_ELEMENTS as string[]).includes(x)) : [];

  const rawTarget = validElements(obj.target);
  const rawIntent = String(obj.intent);
  const intentValid = ["targeted_edit", "full_redesign", "color_change", "add_item", "remove_item", "inquiry"].includes(rawIntent);
  const confidence = Math.min(1, Math.max(0, Number(obj.confidence) || 0));
  const colors = Array.isArray(obj.colors) ? obj.colors.filter((c): c is string => typeof c === "string").slice(0, 5) : undefined;
  const style = typeof obj.style === "string" ? obj.style : undefined;

  // CANONICAL RESOLUTION — single source of truth (scope.ts). The LLM answer
  // is checked against the tree, never the other way around.
  const resolution = resolveScope({
    text: req.prompt,
    selectedTargets: req.selectedTargets,
    uiScope: req.changeScope,
    previousTargets: req.previousTargets,
    previousScope: req.previousScope,
  });

  // Nothing explicit in prompt / UI / memory → the LLM must not invent a
  // scope: fall back to the conservative deterministic reading (fix 2).
  if (resolution.source === "conservative" || (!intentValid && rawTarget.length === 0)) {
    const fb = heuristicUnderstandIntent(req);
    return fb.confidence >= confidence ? fb : { ...fb, confidence };
  }

  const scope = resolution.scope;
  const isFull = scope === "room" || scope === "whole_home";

  // TARGET RESOLUTION — the tree's targets are authoritative; the LLM may
  // only narrow within them (e.g. «مبل و فرش» + LLM says ["sofa"]).
  const narrowed = rawTarget.filter((t) => resolution.targets.includes(t));
  const target = resolution.targets.length > 0
    ? (narrowed.length > 0 && narrowed.length < resolution.targets.length ? narrowed : [...resolution.targets])
    : rawTarget;

  // STRUCTURAL PROTECTION (fix 4) — walls/floor/ceiling/window/door are only
  // targeted when the user EXPLICITLY asked. The LLM can never add them.
  const explicitStructural = detectArchitecturalTargets(String(req.prompt ?? "").toLowerCase());
  const finalTarget = target.filter(
    (t) => !STRUCTURAL_ELEMENTS.includes(t) || explicitStructural.includes(t),
  );

  let intent: IntentAnalysis["intent"];
  if (isFull) intent = "full_redesign";
  else if (finalTarget.length === 0) intent = "inquiry";
  else if (rawIntent === "targeted_edit" || rawIntent === "color_change" || rawIntent === "remove_item" || rawIntent === "add_item") intent = rawIntent;
  else intent = "targeted_edit";

  // Architecture (walls, floor, ceiling, window, door) stays preserved by
  // default in full redesign — preservedElements can only ADD protection.
  const preservedRaw = validElements(obj.preservedElements);
  const preservedElements = [...new Set([
    ...ALL_ELEMENTS.filter((e) => !finalTarget.includes(e)),
    ...preservedRaw.filter((e) => !finalTarget.includes(e)),
  ])];

  return {
    intent,
    target: finalTarget,
    changes: Array.isArray(obj.changes) ? obj.changes.filter((c): c is string => typeof c === "string").slice(0, 3) : [String(req.prompt ?? "").slice(0, 60)],
    preservedElements,
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
