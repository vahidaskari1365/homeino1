// ============================================================
// HOMEINO AI — PIXEL-LOCK COMPOSITE ENGINE  (SERVER-ONLY, sharp)
//
// The guarantee the owner demanded: «مبل جدید بشیند بدون اینکه عکس
// بهم بخورد یا عکس عوض بشه». Generative engines re-render the whole
// canvas — prompt-only preservation ALWAYS drifts. So the pipeline:
//
//   1. builds a feathered mask around the located object(s),
//   2. lets the engine edit the photo (mask attached as guidance),
//   3. PIXEL-LOCKS the result:  final = original ∙ (1−α) + engine ∙ α
//
// Everything OUTSIDE the mask is the user's own pixels — byte-for-byte
// (JPEG re-encode aside), not an approximation. If sharp or the engine
// output misbehave, the lock fails soft: the honest engine image is
// returned unchanged instead of a broken composite.
// ============================================================
import sharp from "sharp";
import type { Sharp } from "sharp";

/** Normalized rect (0..1), origin top-left. */
export interface NormRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Grow a rect by `pad` on every side, clamped to the frame (4-decimal clean). */
export function padRect(rect: NormRect, pad = 0.12): NormRect {
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const x = r4(clamp01(rect.x - pad));
  const y = r4(clamp01(rect.y - pad));
  const width = r4(Math.min(1 - x, rect.width + pad * 2));
  const height = r4(Math.min(1 - y, rect.height + pad * 2));
  return { x, y, width, height };
}

/** Bounding union of rects (null when empty). */
export function unionRects(rects: NormRect[]): NormRect | null {
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/* ---------------- data URL helpers ---------------- */

export function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 64) return null;
  return { buf, mime: m[1] };
}

function toDataUrl(buf: Buffer, mime = "image/jpeg"): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/* ---------------- mask rendering ---------------- */

function rectsToSvg(rects: NormRect[], w: number, h: number, fill: string): string {
  const shapes = rects
    .map((r) => {
      const rx = Math.round(clamp01(r.x) * w);
      const ry = Math.round(clamp01(r.y) * h);
      const rw = Math.max(4, Math.round(r.width * w));
      const rh = Math.max(4, Math.round(r.height * h));
      const radius = Math.min(24, Math.round(Math.min(rw, rh) * 0.12));
      return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${radius}" ry="${radius}" fill="${fill}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${shapes}</svg>`;
}

/**
 * Engine-facing mask: opaque white regions on black, same dimensions as
 * the room photo. Attached to the edit request so the model SEES the area.
 */
export async function buildEngineMask(originalDataUrl: string, rects: NormRect[]): Promise<string | null> {
  const decoded = dataUrlToBuffer(originalDataUrl);
  if (!decoded || !rects.length) return null;
  try {
    const meta = await sharp(decoded.buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 16 || h < 16) return null;
    const png = await sharp(Buffer.from(rectsToSvg(rects, w, h, "#ffffff")))
      .png()
      .toBuffer();
    return toDataUrl(png, "image/png");
  } catch {
    return null;
  }
}

/* ---------------- aspect handling ---------------- */

export type AspectPlan = "resize" | "crop-resize" | "skip";

/**
 * How to fit the engine output back onto the original photo:
 *   • near-identical aspect → plain resize (sub-pixel distortion only)
 *   • drift ≤ 25%           → center-crop to the original aspect, then resize
 *   • worse                 → geometry is unreliable → do NOT pixel-lock
 */
export function aspectPlan(engineW: number, engineH: number, origW: number, origH: number): AspectPlan {
  if (!engineW || !engineH || !origW || !origH) return "skip";
  const re = engineW / engineH;
  const ro = origW / origH;
  const drift = Math.abs(re - ro) / ro;
  if (drift <= 0.05) return "resize";
  if (drift <= 0.25) return "crop-resize";
  return "skip";
}

/* ---------------- the pixel lock ---------------- */

export interface PixelLockInput {
  /** The user's original room photo (data URL). */
  originalDataUrl: string;
  /** The engine's re-rendered photo (data URL, any dimensions). */
  generatedDataUrl: string;
  /** Mask rects (normalized, already padded) that MAY change. */
  rects: NormRect[];
  /** Feather as a share of the shorter mask side (default 0.09). */
  featherPct?: number;
  /**
   * Explicit mask image (white = editable, black/transparent = locked) —
   * e.g. a user-painted MaskCanvas PNG. When present it REPLACES the
   * rect-based mask for the lock (the rects then only guide the engine).
   */
  maskOverrideDataUrl?: string;
}

export type PixelLockResult =
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; reason: string };

/**
 * Composite the engine output back onto the original through the
 * feathered mask. Outside the mask the ORIGINAL pixels survive intact.
 */
export async function pixelLockComposite(input: PixelLockInput): Promise<PixelLockResult> {
  const orig = dataUrlToBuffer(input.originalDataUrl);
  const gen = dataUrlToBuffer(input.generatedDataUrl);
  if (!orig) return { ok: false, reason: "original_decode_failed" };
  if (!gen) return { ok: false, reason: "generated_decode_failed" };
  if (!input.rects.length) return { ok: false, reason: "no_mask_rects" };

  try {
    const origSharp = sharp(orig.buf, { failOn: "none" });
    const meta = await origSharp.metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (W < 16 || H < 16) return { ok: false, reason: "original_too_small" };

    // 1) Fit the engine output onto the original frame.
    const genMeta = await sharp(gen.buf, { failOn: "none" }).metadata();
    const plan = aspectPlan(genMeta.width ?? 0, genMeta.height ?? 0, W, H);
    if (plan === "skip") return { ok: false, reason: "aspect_drift_too_large" };

    let fitted: Sharp;
    if (plan === "crop-resize") {
      // Center-crop the engine output to the original aspect, then resize.
      const re = (genMeta.width ?? 1) / (genMeta.height ?? 1);
      const ro = W / H;
      const cropW = re > ro ? Math.round((genMeta.height ?? 1) * ro) : (genMeta.width ?? 1);
      const cropH = re > ro ? (genMeta.height ?? 1) : Math.round((genMeta.width ?? 1) / ro);
      const left = Math.max(0, Math.floor(((genMeta.width ?? 1) - cropW) / 2));
      const top = Math.max(0, Math.floor(((genMeta.height ?? 1) - cropH) / 2));
      fitted = sharp(gen.buf, { failOn: "none" })
        .extract({ left, top, width: Math.min(cropW, genMeta.width ?? cropW), height: Math.min(cropH, genMeta.height ?? cropH) })
        .resize(W, H, { fit: "fill" });
    } else {
      fitted = sharp(gen.buf, { failOn: "none" }).resize(W, H, { fit: "fill" });
    }
    const fittedBuf = await fitted.png().toBuffer();

    // 2) Feathered alpha mask at original dimensions.
    //    - maskOverrideDataUrl (user-painted) → its luminance IS the alpha.
    //    - otherwise the padded rects, blur-feathered.
    let alphaMask: Buffer;
    if (input.maskOverrideDataUrl) {
      const maskDecoded = dataUrlToBuffer(input.maskOverrideDataUrl);
      if (!maskDecoded) return { ok: false, reason: "mask_decode_failed" };
      const gray = await sharp(maskDecoded.buf, { failOn: "none" })
        .resize(W, H, { fit: "fill" })
        .flatten({ background: "#000000" }) // transparent → locked
        .greyscale()
        .raw()
        .toBuffer();
      const metaGray = { raw: { width: W, height: H, channels: 1 as const } };
      // Engine output cropped BY the mask: gray luminance becomes the alpha.
      const maskedOverride = await sharp(fittedBuf)
        .joinChannel(gray, metaGray)
        .png()
        .toBuffer();
      const finalOverride = await sharp(orig.buf, { failOn: "none" })
        .composite([{ input: maskedOverride, blend: "over" }])
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
      return { ok: true, dataUrl: toDataUrl(finalOverride), width: W, height: H };
    }
    const minSide = Math.min(...input.rects.map((r) => Math.min(r.width * W, r.height * H)));
    const featherPx = Math.max(6, Math.round(minSide * (input.featherPct ?? 0.09)));
    alphaMask = await sharp(
      Buffer.from(rectsToSvg(input.rects, W, H, "#ffffff")),
    )
      .blur(featherPx / 2)
      .png()
      .toBuffer();

    // 3) Engine output cropped BY the mask (mask alpha becomes the image alpha).
    const maskedEngine = await sharp(fittedBuf)
      .composite([{ input: alphaMask, blend: "dest-in" }])
      .png()
      .toBuffer();

    // 4) Original below, engine above → outside the mask the original survives.
    const finalBuf = await sharp(orig.buf, { failOn: "none" })
      .composite([{ input: maskedEngine, blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return { ok: true, dataUrl: toDataUrl(finalBuf), width: W, height: H };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? `composite_failed: ${err.message}` : "composite_failed" };
  }
}
