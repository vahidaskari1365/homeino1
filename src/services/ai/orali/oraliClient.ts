// ============================================================
// Orali HTTP Client — SERVER-ONLY. Never imported by a client
// bundle; resolved exclusively inside the AI pipeline.
//
// REAL ENGINE (live-tested): the image-edit endpoint accepts
//   POST {BASE}/images/generations/edit
//   { prompt, images: [{ url: <dataURL> }], size: "1344x768" }
// and returns { data: [{ url }] } with the edited image. The
// generation endpoint accepts { prompt, size } and the chat
// endpoint speaks plain OpenAI /chat/completions.
//
// Env (preferred in production):
//   ORALI_API_BASE_URL / ZAI_API_BASE_URL   e.g. https://internal-api.z.ai/v1
//   ORALI_API_KEY     / ZAI_API_KEY         bearer key
//   ZAI_API_TOKEN                           optional X-Token header
// File fallback (sandbox/self-hosted): reads `.z-ai-config`
// (JSON with baseUrl+apiKey[+token]) from process cwd, $HOME,
// then /etc — the same search order the z-ai SDK uses.
// ============================================================
import type {
  OraliClient, OraliEditRequest, OraliEditResult,
} from "./types";
import { OraliNotConfiguredError, OraliRequestError } from "./types";
import { engineConfig, type EngineConfig } from "../engineConfig";
import { toEngineEnglish } from "../engineTranslate";

/** Default chat models per dialect (overridable via ZAI_CHAT_MODEL / GLM_CHAT_MODEL). */
function chatModelFor(cfg: EngineConfig): string {
  return cfg.chatModel || (cfg.flavor === "zai-public" ? "glm-4.7-flash" : "glm-4.5");
}

/**
 * glm-image (public API) only accepts 1024–2048px, divisible by 32.
 * Snap the engine-style size into that window, keeping the aspect ratio
 * as close as the grid allows. cogview-4 sizes pass through untouched.
 */
function sizeForPublicModel(size: string, imageModel: string): string {
  if (!imageModel.startsWith("glm-image")) return size;
  const [w, h] = size.split("x").map(Number);
  const snap = (n: number) => Math.min(2048, Math.max(1024, Math.round(n / 32) * 32));
  return `${snap(w)}x${snap(h)}`;
}

/** Sizes the edit/generation endpoint actually supports (tested 2025). */
const SUPPORTED_SIZES = [
  "1024x1024", "768x1344", "864x1152", "1344x768", "1152x864", "1440x720", "720x1440",
] as const;

export const isOraliConfigured = (): boolean => engineConfig() !== null;

function authHeaders(cfg: EngineConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
    "X-Z-AI-From": "Z",
  };
  if (cfg.token) headers["X-Token"] = cfg.token;
  return headers;
}

/** POST with a single 429-retry (quota blips) — bounded, never infinite. */
async function postWithRetry(cfg: EngineConfig, path: string, body: unknown, signal: AbortSignal): Promise<Response> {
  let res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST", signal, headers: authHeaders(cfg), body: JSON.stringify(body),
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 9_000));
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST", signal, headers: authHeaders(cfg), body: JSON.stringify(body),
    });
  }
  return res;
}

/* ---- image size helpers: match the engine's supported canvas ---- */

/** Decode intrinsic pixel size of a PNG/JPEG data URL (no deps). */
function dataUrlSize(dataUrl: string): { w: number; h: number } | null {
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,([\s\S]*)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (m[1] === "png" && buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: scan SOF markers
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off += 1; continue; }
    const marker = buf[off + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return null;
}

/** Closest engine canvas to the input's aspect ratio (fallback 4:3 landscape). */
function pickSize(dataUrl: string): string {
  const dim = dataUrlSize(dataUrl);
  const ratio = dim && dim.w > 0 ? dim.w / dim.h : 4 / 3;
  let best: string = SUPPORTED_SIZES[3]; // 1344x768
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const size of SUPPORTED_SIZES) {
    const [w, h] = size.split("x").map(Number);
    const diff = Math.abs(w / h - ratio);
    if (diff < bestDiff) { bestDiff = diff; best = size; }
  }
  return best;
}

/* ---- prompt assembly: fold preservation rules into the instruction ---- */

function buildEditPrompt(req: OraliEditRequest): string {
  const parts = [req.instruction.trim()];
  if (req.protectedElements?.length) {
    parts.push(`Keep these elements strictly unchanged: ${req.protectedElements.join(", ")}.`);
  }
  if (req.preserveArchitecture) {
    parts.push("Do NOT move, add or remove walls, windows, doors, the ceiling or the floor. Keep the exact same camera angle, perspective, room dimensions and lighting.");
  }
  if (req.targetRegion) {
    const { x, y, w, h } = req.targetRegion;
    parts.push(`Apply the change inside the region around (${Math.round((x + w / 2) * 100)}% from left, ${Math.round((y + h / 2) * 100)}% from top, ${Math.round(w * 100)}% width) and nowhere else.`);
  }
  if (req.mask) {
    parts.push("Edit ONLY the user-highlighted mask area; everything outside it stays pixel-identical.");
  }
  if (req.style) parts.push(`Target decor style: ${req.style}.`);
  if (req.colors?.length) parts.push(`Palette to respect: ${req.colors.join(", ")}.`);
  parts.push("Photorealistic result, consistent lighting and shadows with the original photo.");
  return parts.join(" ");
}

/** Download the engine's result URL into a data URL (client always renderable). */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new OraliRequestError(`ORALI_DOWNLOAD_${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export const oraliClient: OraliClient = {
  get name() { return "orali" as const; },
  get configured() { return isOraliConfigured(); },

  async generateEdit(req: OraliEditRequest): Promise<OraliEditResult> {
    const cfg = engineConfig();
    if (!cfg) throw new OraliNotConfiguredError();

    // The OFFICIAL z.ai GLM API is generation-only (documented 2026-09:
    // /paas/v4/images/generations has no edit companion). Editing stays a
    // capability of the self-hosted/sandbox engine — fail honestly instead
    // of pretending. The pipeline falls back (Gemini key → honest error).
    if (cfg.flavor === "zai-public") {
      throw new OraliRequestError(
        "ORALI_NO_EDIT_PUBLIC: the official GLM API does not support image editing — "
        + "configure the self-hosted engine or a Gemini key for edits",
        501,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // image edits can be slow
    const started = Date.now();
    try {
      // The engine's content filter false-positives on Persian script —
      // image prompts must go out in English (chat endpoint is Persian-safe).
      const enginePrompt = await toEngineEnglish(buildEditPrompt(req));
      const res = await postWithRetry(cfg, "/images/generations/edit", {
        prompt: enginePrompt,
        images: [{ url: req.image }], // engine contract: array of {url} (data URL accepted)
        size: pickSize(req.image),
      }, controller.signal);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new OraliRequestError(`ORALI_HTTP_${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`, res.status);
      }
      const data = (await res.json()) as { data?: { url?: string; base64?: string; b64_json?: string }[] };
      const item = data?.data?.[0];
      const raw = item?.url ?? (item?.base64 ? `data:image/png;base64,${item.base64}` : undefined)
        ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined);
      if (!raw) throw new OraliRequestError("ORALI_EMPTY_IMAGE");
      return {
        image: await toDataUrl(raw),
        regions: [], // honest: this engine does not report per-region metadata
        model: "zimage-edit",
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      if (err instanceof OraliRequestError || err instanceof OraliNotConfiguredError) throw err;
      if (err instanceof Error && err.name === "AbortError") throw new OraliRequestError("ORALI_TIMEOUT");
      throw new OraliRequestError(err instanceof Error ? `ORALI_FAILED: ${err.message}` : "ORALI_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },
};

/** Text-to-image via the same engine (used by the ZAI provider for `generate`). */
export async function engineGenerate(prompt: string, size = "1344x768"): Promise<string> {
  const cfg = engineConfig();
  if (!cfg) throw new OraliNotConfiguredError();
  const enginePrompt = await toEngineEnglish(prompt); // Persian → English (filter-safe)
  // Public API requires an explicit model; the self-hosted engine infers it.
  const body = cfg.flavor === "zai-public"
    ? {
        model: cfg.imageModel || "cogview-4-250304", // ≈$0.01/image; glm-image possible via GLM_IMAGE_MODEL
        prompt: enginePrompt,
        size: sizeForPublicModel(size, cfg.imageModel || "cogview-4-250304"),
      }
    : { prompt: enginePrompt, size };
  const res = await postWithRetry(cfg, "/images/generations", body, AbortSignal.timeout(180_000));
  if (!res.ok) throw new OraliRequestError(`ORALI_HTTP_${res.status}`);
  const data = (await res.json()) as { data?: { url?: string; base64?: string }[] };
  const raw = data?.data?.[0]?.url ?? data?.data?.[0]?.base64;
  if (!raw) throw new OraliRequestError("ORALI_EMPTY_IMAGE");
  return toDataUrl(raw);
}

/** Chat completion via the same engine's OpenAI-compatible endpoint. */
export async function engineChat(messages: { role: "system" | "user" | "assistant"; content: string }[], opts?: { temperature?: number }): Promise<string> {
  const cfg = engineConfig();
  if (!cfg) throw new OraliNotConfiguredError();
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify({ model: chatModelFor(cfg), messages, temperature: opts?.temperature ?? 0.7, max_tokens: 1200 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new OraliRequestError(`ORALI_HTTP_${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content ?? "";
}
