/**
 * LLM Service abstraction — UI never talks to a provider.
 * Pipeline: AI Provider → LLM Service → AI Designer
 */
import type { StructuredIntent } from "./intentSchema";
import { EMPTY_INTENT, INTENT_JSON_KEYS, isBroadStyleRequest } from "./intentSchema";
import { detectIntent, parseLLMJson } from "./roomState";

export interface LlmUnderstandInput {
  prompt: string;
  style?: string;
  roomType?: string;
  colors?: string[];
  keep?: string;
  change?: string;
}

export interface LlmService {
  understandIntent(input: LlmUnderstandInput): Promise<StructuredIntent>;
}

function heuristicIntent(input: LlmUnderstandInput): StructuredIntent {
  const text = [input.prompt, input.change, input.keep].filter(Boolean).join(" ");
  const raw = detectIntent(text, input.style);
  const broad = isBroadStyleRequest(text) || raw.type === "full_redesign";
  return {
    intent: broad ? "style_transform" : raw.type === "color_change" ? "color_change" : raw.targets.length ? "object_replace" : "unclear",
    target: raw.targets as StructuredIntent["target"],
    changes: raw.requestedChanges,
    preservedElements: broad
      ? ["layout", "perspective", "architecture", "windows", "doors"]
      : ["layout", "perspective", "architecture", "windows", "doors", "walls", "floor", "ceiling", ...raw.lockedElements],
    style: input.style,
    colors: input.colors ?? [],
    confidence: raw.confidence,
    scope: broad ? "broad" : "local",
  };
}

/** Client-safe: posts to /api/ai action=understand */
export const llmService: LlmService = {
  async understandIntent(input) {
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "understand", payload: input }),
      });
      if (!res.ok) return heuristicIntent(input);
      const data = await res.json();
      return parseLLMJson<StructuredIntent>(JSON.stringify(data), [...INTENT_JSON_KEYS], heuristicIntent(input));
    } catch {
      return heuristicIntent(input);
    }
  },
};

export function localUnderstand(input: LlmUnderstandInput): StructuredIntent {
  return heuristicIntent(input) ?? EMPTY_INTENT;
}
