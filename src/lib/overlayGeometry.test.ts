import { describe, expect, it } from "vitest";
import { clamp01, computeCoverRect, imageToPixel, pixelToImage } from "./overlayGeometry";

describe("overlayGeometry", () => {
  it("clamps to 0..1 and treats NaN as 0", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it("computes object-fit:cover rect for a wide image in a square box", () => {
    const cover = computeCoverRect({ width: 100, height: 100 }, { width: 200, height: 100 });
    // scale = max(100/200, 100/100) = 1 → rendered 200x100, offsetX -50
    expect(cover.scale).toBe(1);
    expect(cover.visibleWidth).toBe(200);
    expect(cover.visibleHeight).toBe(100);
    expect(cover.offsetX).toBe(-50);
    expect(cover.offsetY).toBe(0);
  });

  it("round-trips image-space ↔ pixel-space", () => {
    const cover = computeCoverRect({ width: 400, height: 300 }, { width: 800, height: 600 });
    const px = imageToPixel(cover, 0.5, 0.25);
    const back = pixelToImage(cover, px.left, px.top);
    expect(back.xNorm).toBeCloseTo(0.5, 8);
    expect(back.yNorm).toBeCloseTo(0.25, 8);
  });
});
