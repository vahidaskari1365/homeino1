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
// ============================================================
import type { IntentRequest, IntentAnalysis, LlmProvider } from "./types";
import { ALL_ELEMENTS, type RoomElement } from "../roomState";
import { heuristicUnderstandIntent } from "./heuristicLlm";

const BASE = () => (process.env.LLM_API_BASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.LLM_API_KEY || "";
const MODEL = () => process.env.LLM_MODEL || "auto";

export const isOpenAiCompatConfigured = (): boolean => Boolean(BASE() && KEY());

const SYSTEM_PROMPT = `You are the intent-analysis module of Homeino, an interior-design AI.
Your ONLY job: convert the user's (Persian) request into a tiny JSON object. Never chat. Never explain.

Return EXACTLY this JSON shape and nothing else:
{"intent":"targeted_edit|full_redesign|color_change|add_item|remove_item|inquiry","target":["sofa"],"changes":["short phrase"],"preservedElements":["wall","floor"],"style":"modern","colors":["کرم"],"confidence":0.9}

Element vocabulary (the ONLY allowed target/preservedElements values):
sofa, rug, curtain, lighting, wall, floor, ceiling, table, chair, tv, plant, art, door, window, shelf, bed

Rules:
- "مبل را عوض کن" → target ONLY ["sofa"]. Everything else goes to preservedElements.
- "رنگ دیوار را کرم کن" → intent color_change, target ["wall"], colors ["کرم"].
- "این اتاق را مدرن کن" (or any broad/full-room phrasing) → intent full_redesign, target = all elements, preservedElements = [].
- If the request is unclear → intent inquiry, ambiguous reading, confidence < 0.5.
- changes: max 3 short phrases. No long text. JSON only.`;

async function callCompat(req: IntentRequest): Promise<IntentAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
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
          {
            role: "user",
            content: JSON.stringify({
              prompt: req.prompt,
              style: req.style,
              room: req.room,
              colors: req.colors,
              changeScope: req.changeScope,
              selectedTargets: req.selectedTargets,
            }),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("llm_no_json");
    return normalizeIntentAnalysis(JSON.parse(match[0]), req);
  } finally {
    clearTimeout(timeout);
  }
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

  if (intent === "inquiry" || target.length === 0) {
    // Invalid/empty reading → fall back to the deterministic engine.
    const fb = heuristicUnderstandIntent(req);
    return fb.confidence >= confidence ? fb : { ...fb, confidence };
  }

  return {
    intent,
    target: intent === "full_redesign" ? [...ALL_ELEMENTS] : target,
    changes: Array.isArray(obj.changes) ? obj.changes.filter((c): c is string => typeof c === "string").slice(0, 3) : [req.prompt.slice(0, 60)],
    preservedElements: intent === "full_redesign" ? [] : (preserved.length ? preserved : ALL_ELEMENTS.filter((e) => !target.includes(e))),
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
