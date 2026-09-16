// ============================================================
// PIXEL-LOCK COMPOSITE TESTS — mask math + REAL sharp compositing.
// The core guarantee: outside the mask the ORIGINAL pixels survive.
// ============================================================
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  padRect,
  unionRects,
  aspectPlan,
  pixelLockComposite,
  buildEngineMask,
  type NormRect,
} from "./serverComposite";

const rect = (x: number, y: number, width: number, height: number): NormRect => ({ x, y, width, height });

describe("mask math", () => {
  it("padRect grows and clamps to the frame", () => {
    expect(padRect(rect(0.5, 0.5, 0.2, 0.2), 0.1)).toEqual(rect(0.4, 0.4, 0.4, 0.4));
    // pad 0.2 on BOTH sides of a 0.1-wide corner rect (clamped at the frame).
    expect(padRect(rect(0.0, 0.0, 0.1, 0.1), 0.2)).toEqual(rect(0, 0, 0.5, 0.5));
    expect(padRect(rect(0.9, 0.9, 0.1, 0.1), 0.2)).toEqual(rect(0.7, 0.7, 0.3, 0.3));
  });

  it("unionRects bounds every rect", () => {
    expect(unionRects([])).toBeNull();
    const u = unionRects([rect(0.1, 0.1, 0.2, 0.2), rect(0.5, 0.6, 0.2, 0.2)]);
    expect(u!.x).toBeCloseTo(0.1);
    expect(u!.y).toBeCloseTo(0.1);
    expect(u!.width).toBeCloseTo(0.6);
    expect(u!.height).toBeCloseTo(0.7);
  });

  it("aspectPlan picks the right fitting strategy", () => {
    expect(aspectPlan(200, 150, 200, 150)).toBe("resize");
    expect(aspectPlan(1344, 768, 1280, 720)).toBe("resize"); // ~1.75 vs ~1.78
    expect(aspectPlan(1024, 1024, 1280, 960)).toBe("crop-resize"); // 1:1 vs 4:3 → 0.25
    expect(aspectPlan(1024, 1024, 1600, 900)).toBe("skip"); // 1:1 vs 16:9 → 0.44
    expect(aspectPlan(1024, 1024, 1200, 400)).toBe("skip"); // 2.56 vs 3.0
    expect(aspectPlan(0, 0, 100, 100)).toBe("skip");
  });
});

/* ---------------- helpers: synthetic photos ---------------- */

async function solidImage(w: number, h: number, rgb: { r: number; g: number; b: number }): Promise<string> {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background: rgb } })
    .jpeg({ quality: 98 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function samplePixel(dataUrl: string, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const { data, info } = await sharp(Buffer.from(b64, "base64")).raw().toBuffer({ resolveWithObject: true });
  const idx = (y * info.width + x) * info.channels;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

const RED = { r: 220, g: 30, b: 30 };
const GREEN = { r: 30, g: 200, b: 60 };
const closeTo = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, tol = 24) =>
  Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;

describe("pixelLockComposite (real sharp)", () => {
  it("keeps ORIGINAL pixels outside the mask and engine pixels inside", async () => {
    const original = await solidImage(200, 150, RED);
    const generated = await solidImage(200, 150, GREEN);
    const rects = [padRect(rect(0.35, 0.35, 0.3, 0.3), 0)]; // centered 60x45px

    const result = await pixelLockComposite({ originalDataUrl: original, generatedDataUrl: generated, rects });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Center of the mask → engine (green).
    const center = await samplePixel(result.dataUrl, 100, 75);
    expect(closeTo(center, GREEN)).toBe(true);

    // Corners & edges outside the mask → ORIGINAL (red).
    expect(closeTo(await samplePixel(result.dataUrl, 10, 10), RED)).toBe(true);
    expect(closeTo(await samplePixel(result.dataUrl, 190, 140), RED)).toBe(true);
    expect(closeTo(await samplePixel(result.dataUrl, 20, 75), RED)).toBe(true);
    expect(closeTo(await samplePixel(result.dataUrl, 100, 10), RED)).toBe(true);
  });

  it("fits a square engine output onto a 4:3 original (crop-resize)", async () => {
    const original = await solidImage(200, 150, RED); // 4:3
    const generated = await solidImage(400, 400, GREEN); // 1:1 → drift 0.25
    const rects = [rect(0.4, 0.3, 0.2, 0.4)];

    const result = await pixelLockComposite({ originalDataUrl: original, generatedDataUrl: generated, rects });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(closeTo(await samplePixel(result.dataUrl, 100, 75), GREEN)).toBe(true);
    expect(closeTo(await samplePixel(result.dataUrl, 10, 10), RED)).toBe(true);
    expect(closeTo(await samplePixel(result.dataUrl, 190, 140), RED)).toBe(true);
  });

  it("honors a user-painted mask override (white = editable)", async () => {
    const original = await solidImage(200, 150, RED);
    const generated = await solidImage(200, 150, GREEN);
    // Mask: white strip on the left half, black elsewhere (NOT a rect shape).
    const maskSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect x="0" y="0" width="100" height="150" fill="#ffffff"/></svg>`,
    );
    const maskPng = await sharp(maskSvg).png().toBuffer();
    const maskDataUrl = `data:image/png;base64,${maskPng.toString("base64")}`;

    const result = await pixelLockComposite({
      originalDataUrl: original,
      generatedDataUrl: generated,
      rects: [rect(0.1, 0.1, 0.2, 0.2)], // ignored — override wins
      maskOverrideDataUrl: maskDataUrl,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(closeTo(await samplePixel(result.dataUrl, 50, 75), GREEN)).toBe(true); // inside painted mask
    expect(closeTo(await samplePixel(result.dataUrl, 150, 75), RED)).toBe(true); // outside → original
  });

  it("fails soft — no rects, bad input, huge aspect drift", async () => {
    const original = await solidImage(200, 150, RED);
    const generated = await solidImage(200, 150, GREEN);

    expect((await pixelLockComposite({ originalDataUrl: original, generatedDataUrl: generated, rects: [] })).ok).toBe(false);
    expect((await pixelLockComposite({ originalDataUrl: "not-a-data-url", generatedDataUrl: generated, rects: [rect(0.1, 0.1, 0.2, 0.2)] })).ok).toBe(false);
    // 1:1 engine onto a 1:5 panorama → geometry unreliable → no lock.
    const pano = await solidImage(500, 100, RED);
    expect((await pixelLockComposite({ originalDataUrl: pano, generatedDataUrl: generated, rects: [rect(0.1, 0.1, 0.2, 0.2)] })).ok).toBe(false);
  });
});

describe("buildEngineMask (real sharp)", () => {
  it("renders white rects on black at the original size", async () => {
    const original = await solidImage(200, 100, RED);
    const mask = await buildEngineMask(original, [rect(0.25, 0.25, 0.5, 0.5)]);
    expect(mask).toBeTruthy();
    if (!mask) return;
    expect(mask.startsWith("data:image/png;base64,")).toBe(true);

    const meta = await sharp(Buffer.from(mask.replace(/^data:image\/\w+;base64,/, ""), "base64")).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);

    const b64 = mask.replace(/^data:image\/\w+;base64,/, "");
    const { data, info } = await sharp(Buffer.from(b64, "base64")).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return data[i];
    };
    expect(px(100, 50)).toBe(255); // inside rect → white
    expect(px(5, 5)).toBe(0); // outside rect → black
  });

  it("returns null for broken inputs", async () => {
    expect(await buildEngineMask("not-a-data-url", [rect(0.1, 0.1, 0.2, 0.2)])).toBeNull();
    const original = await solidImage(200, 100, RED);
    expect(await buildEngineMask(original, [])).toBeNull();
  });
});
