/** Structured intent — LLM must return this JSON, never long chat. */

export type DesignConcept =
  | "room"
  | "object"
  | "furniture"
  | "wall"
  | "floor"
  | "ceiling"
  | "lighting"
  | "decor"
  | "color"
  | "material"
  | "style";

export type IntentKind =
  | "object_replace"
  | "color_change"
  | "style_transform"
  | "full_redesign"
  | "lighting_change"
  | "material_change"
  | "add_object"
  | "unclear";

export interface StructuredIntent {
  intent: IntentKind;
  target: DesignConcept[];
  changes: string[];
  preservedElements: string[];
  style?: string;
  colors: string[];
  confidence: number;
  scope: "local" | "broad";
}

export const INTENT_JSON_KEYS = [
  "intent",
  "target",
  "changes",
  "preservedElements",
  "colors",
  "confidence",
] as const;

export const EMPTY_INTENT: StructuredIntent = {
  intent: "unclear",
  target: [],
  changes: [],
  preservedElements: [
    "layout",
    "perspective",
    "architecture",
    "windows",
    "doors",
    "walls",
    "floor",
    "ceiling",
  ],
  colors: [],
  confidence: 0,
  scope: "local",
};

export function isBroadStyleRequest(text: string): boolean {
  const t = text.toLowerCase();
  return /این اتاق را|کل اتاق|کل فضا|مدرن کن|کلاسیک کن|مینیمال کن|بازطراحی|همه را|سبک .* کن/.test(t);
}
