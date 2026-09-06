// ============================================================
// Pollinations.ai — KEYLESS free image generation (SERVER-ONLY).
//
// Live-tested: GET https://image.pollinations.ai/prompt/{prompt}
//   ?width=&height=&nologo=true&seed=  →  image bytes (model: sana)
// No API key required — the free tier powers guest "generate"
// requests when no other engine is configured. Text/chat APIs
// moved behind auth (402) and are intentionally NOT used here.
// ============================================================

const IMG_BASE = "https://image.pollinations.ai/prompt";

export interface PollinationsResult {
  dataUrl: string;
  model: string;
  latencyMs: number;
}

/** Clamp to sane image budgets (engine allows arbitrary size). */
function clampSize(w?: number, h?: number): { width: number; height: number } {
  const width = Math.min(1440, Math.max(512, Math.round(w || 1024)));
  const height = Math.min(1440, Math.max(512, Math.round(h || 768)));
  return { width, height };
}

export async function pollinationsImage(
  prompt: string,
  opts?: { width?: number; height?: number; seed?: number },
): Promise<PollinationsResult> {
  const started = Date.now();
  const { width, height } = clampSize(opts?.width, opts?.height);
  const seed = opts?.seed ?? Math.floor(Math.random() * 1_000_000);
  const url =
    `${IMG_BASE}/${encodeURIComponent(prompt.slice(0, 900))}` +
    `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=sana`;
  const res = await fetch(url, { signal: AbortSignal.timeout(150_000) });
  if (!res.ok) throw new Error(`POLLINATIONS_HTTP_${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mime.startsWith("image/")) throw new Error("POLLINATIONS_NOT_IMAGE");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000) throw new Error("POLLINATIONS_EMPTY");
  return {
    dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
    model: "pollinations-sana",
    latencyMs: Date.now() - started,
  };
}
