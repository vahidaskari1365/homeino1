// ============================================================
// HOMEINO STUDIO — ROOM OBJECT DETECTION (SERVER-ONLY)
//
// «محصول باید دقیقاً جای معادلش در عکس بنشیند.»
// The replacement planner previously used fixed per-category anchor
// points, so a sofa landed on a generic spot instead of the real
// sofa in the photo. This module asks the vision model for the
// CURRENT bounding box of each counterpart type, normalized 0..1,
// and feeds real positions into the placement engine.
//
// Honest + deterministic degradation:
//   • No Gemini key (DB or env) → [] (planner falls back to anchors)
//   • Any failure/timeout → [] — never blocks the studio flow
//   • Boxes are clamped + shape-validated; garbage is dropped
//
// Task 39 — باگ پروداکشن: کلید فقط از process.env خوانده می‌شد؛ وقتی کلید
// در پنل ادمین (DB رمزنگاری‌شده) بود، تشخیص ساکت [] برمی‌گرداند → ماسک صفر
// → ویرایش تمام‌عکس («کل عکس عوض میشه»). حالا همان resolveGeminiConfig
// (پنل ادمین > env) که بقیه‌ی پایپ‌لاین استفاده می‌کند.
// ============================================================

// "محصول باید دقیقاً جای معادلش در عکس بنشیند." — با کلید واحد resolveGeminiConfig
import { resolveGeminiConfig } from "./settings";
import { zaiVisionText } from "./zaiVision";

export interface DetectedCounterpart {
  /** Element/category vocabulary key (sofa, rug, table, lamp…). */
  type: string;
  /** Normalized region (0..1, origin top-left). */
  region: { x: number; y: number; w: number; h: number };
}

const clamp01 = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

// Model comes from the SINGLE config source (env → admin panel) so the
// detection model always matches the rest of the pipeline.
const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const API = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

/** Canonical label set keeps the prompt tight and parsing deterministic. */
export const DETECTABLE_TYPES = [
  "sofa", "furniture", "bed", "dining", "table", "chair", "carpet", "rug",
  "curtain", "lighting", "lamp", "tv", "art", "decor", "plants",
  "shelf", "bookcase", "office", "outdoor", "accessories",
] as const;

const KNOWN_TYPES = new Set<string>(DETECTABLE_TYPES);

/** Pure parser — exported for deterministic tests. */
export function parseCounterparts(raw: string): DetectedCounterpart[] {
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return [];
    const parsed = JSON.parse(json) as { objects?: unknown };
    if (!Array.isArray(parsed.objects)) return [];
    const out: DetectedCounterpart[] = [];
    for (const item of parsed.objects) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const type = typeof o.type === "string" ? o.type.trim().toLowerCase().replace(/[_\s]+/g, "-") : "";
      if (!type || !KNOWN_TYPES.has(type)) continue;
      const box = (o.box ?? o.boundingBox ?? o.bbox) as Record<string, unknown> | undefined;
      if (!box || typeof box !== "object") continue;
      const w = clamp01(box.w);
      const h = clamp01(box.h);
      // A counterpart must occupy a sane area to be trusted.
      if (w < 0.03 || h < 0.03) continue;
      out.push({ type, region: { x: clamp01(box.x), y: clamp01(box.y), w, h } });
    }
    // At most one region per type — the largest (most confident footprint) wins.
    const byType = new Map<string, DetectedCounterpart>();
    for (const d of out) {
      const prev = byType.get(d.type);
      if (!prev || d.region.w * d.region.h > prev.region.w * prev.region.h) byType.set(d.type, d);
    }
    return [...byType.values()];
  } catch {
    return [];
  }
}

/**
 * Ask the vision model where each counterpart currently sits in the photo.
 * Returns [] on ANY failure — the caller's planner then falls back to
 * the deterministic category anchors (today's behavior).
 */
/** MIME واقعی عکس را از data URL می‌خواند (webp/png/jpeg — نه همیشه jpeg). */
function mimeOf(imageDataUrl: string): string {
  const m = /^data:(image\/[\w.+-]+);base64,/.exec(imageDataUrl);
  return m?.[1] ?? "image/jpeg";
}

/** پرامپت مشترک مکان‌یابی — Gemini و fallback رایگان هر دو همین را می‌خوانند. */
function locatePrompt(wanted: string[]): string {
  return `Locate the CURRENT position of each of these furniture categories in this room photo: ${wanted.join(", ")}. For every category that is actually visible, give the bounding box it occupies. Reply ONLY compact JSON: {"objects":[{"type":"<one of: ${DETECTABLE_TYPES.join("|")}","box":{"x":0..1,"y":0..1,"w":0..1,"h":0..1}}]} — coordinates normalized to the whole photo, origin top-left. Omit categories that are NOT visible. If nothing is visible reply {"objects":[]}.`;
}

async function geminiLocate(apiKey: string, model: string, b64: string, mime: string, wanted: string[]): Promise<DetectedCounterpart[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: locatePrompt(wanted) },
            { inline_data: { mime_type: mime, data: b64 } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return parseCounterparts(text);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the vision model where each counterpart currently sits in the photo.
 * Chain: Gemini (پنل ادمین/env) → z-ai vision رایگان → [] — the caller's
 * planner then falls back to the deterministic category anchors.
 */
export async function detectCounterparts(imageDataUrl: string, wanted: string[]): Promise<DetectedCounterpart[]> {
  if (!imageDataUrl || wanted.length === 0) return [];
  const b64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  // Remote URLs cannot be sent inline — vision needs the actual pixels.
  if (!b64 || b64 === imageDataUrl) return [];
  const mime = mimeOf(imageDataUrl);

  const { apiKey, textModel } = await resolveGeminiConfig();
  if (apiKey) {
    const located = await geminiLocate(apiKey, textModel || process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL, b64, mime, wanted);
    if (located.length) return located;
  }
  // Task 39 — fallback رایگان: بدون کلید Gemini هم مکان‌یابی می‌شود.
  const free = await zaiVisionText(
    "You are a furniture-locating vision engine. Reply ONLY with the requested compact JSON — no prose.",
    locatePrompt(wanted),
    imageDataUrl,
  );
  return free ? parseCounterparts(free) : [];
}
