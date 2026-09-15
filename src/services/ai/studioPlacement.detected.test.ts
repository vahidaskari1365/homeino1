// ============================================================
// VISION-FIRST COUNTERPART REPLACEMENT — TESTS
// When the photo's counterpart is detected, the product must sit
// EXACTLY there; without detection, today's anchor behavior holds.
// ============================================================
import { describe, it, expect } from "vitest";
import {
  planReplacementPlacements,
  matchCounterpart,
  type StudioProductInput,
  type DetectedCounterpart,
} from "./studioPlacement";
import { parseCounterparts } from "./roomObjects";

const sofa: StudioProductInput = { id: "p1", name: "مبل راحتی مدل آریا", category: "furniture" };

const detectedSofa: DetectedCounterpart = {
  type: "sofa",
  region: { x: 0.10, y: 0.55, w: 0.55, h: 0.30 },
};

describe("matchCounterpart — family aliasing", () => {
  it("maps generic furniture to a detected sofa", () => {
    expect(matchCounterpart("furniture", [detectedSofa])?.type).toBe("sofa");
  });
  it("maps carpet/rug interchangeably", () => {
    const rug: DetectedCounterpart = { type: "rug", region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 } };
    expect(matchCounterpart("carpet", [rug])?.type).toBe("rug");
    expect(matchCounterpart("rug", [{ ...rug, type: "carpet" }])?.type).toBe("carpet");
  });
  it("returns null when no family member was detected", () => {
    const lamp: DetectedCounterpart = { type: "lamp", region: { x: 0.1, y: 0.4, w: 0.1, h: 0.3 } };
    expect(matchCounterpart("furniture", [lamp])).toBeNull();
  });
  it("returns null on empty/missing detections", () => {
    expect(matchCounterpart("furniture", [])).toBeNull();
    expect(matchCounterpart("furniture", undefined)).toBeNull();
  });
  it("prefers the exact category match over a larger alias", () => {
    const sofaBig: DetectedCounterpart = { type: "sofa", region: { x: 0.1, y: 0.5, w: 0.6, h: 0.3 } };
    const furniture: DetectedCounterpart = { type: "furniture", region: { x: 0.3, y: 0.5, w: 0.2, h: 0.2 } };
    expect(matchCounterpart("sofa", [sofaBig, furniture])?.type).toBe("sofa");
  });
});

describe("planReplacementPlacements — vision-first anchoring", () => {
  it("places the product at the DETECTED counterpart center with its footprint", () => {
    const [plan] = planReplacementPlacements([sofa], { roomType: "living", detected: [detectedSofa] });
    const cx = plan.targetRegion.x + plan.targetRegion.width / 2;
    const cy = plan.targetRegion.y + plan.targetRegion.height / 2;
    expect(cx).toBeCloseTo(0.10 + 0.55 / 2, 2);
    expect(cy).toBeCloseTo(0.55 + 0.30 / 2, 2);
    expect(plan.targetRegion.width).toBeCloseTo(0.55, 2);
    expect(plan.sizeReport).toContain("پیدا‌شده");
  });

  it("keeps the real product aspect inside the detected footprint", () => {
    const tall = { ...sofa, dimensions: { width: 200, height: 100 } };
    const [plan] = planReplacementPlacements([tall], { roomType: "living", detected: [detectedSofa] });
    // height = (100/200) * detected width
    expect(plan.targetRegion.height).toBeCloseTo(0.55 / 2, 2);
  });

  it("falls back to category anchors when nothing was detected (regression guard)", () => {
    const [without] = planReplacementPlacements([sofa], { roomType: "living" });
    const [withEmpty] = planReplacementPlacements([sofa], { roomType: "living", detected: [] });
    expect(withEmpty.targetRegion.x).toBeCloseTo(without.targetRegion.x, 5);
    expect(without.sizeReport).not.toContain("پیدا‌شده");
  });

  it("clamps an absurd detection into the visible frame", () => {
    const wild: DetectedCounterpart = { type: "sofa", region: { x: 0.9, y: 0.9, w: 0.95, h: 0.8 } };
    const [plan] = planReplacementPlacements([sofa], { roomType: "living", detected: [wild] });
    expect(plan.targetRegion.x).toBeLessThanOrEqual(0.98);
    expect(plan.targetRegion.y).toBeLessThanOrEqual(0.98);
    expect(plan.targetRegion.width).toBeLessThanOrEqual(0.92);
  });

  it("one detection = one replacement: the second same-type product falls back to its anchor", () => {
    const a = planReplacementPlacements([sofa, { ...sofa, id: "p2", name: "مبل راحتی مدل بهار" }], {
      roomType: "living",
      detected: [detectedSofa],
    });
    expect(a).toHaveLength(2);
    // First sits on the detected counterpart, second uses the category anchor.
    expect(a[0].sizeReport).toContain("پیدا‌شده");
    expect(a[1].sizeReport).not.toContain("پیدا‌شده");
    const [c1, c2] = a.map((p) => p.targetRegion.x + p.targetRegion.width / 2);
    expect(c1).not.toBeCloseTo(c2, 3);
  });
});

describe("parseCounterparts — robust vision parsing", () => {
  it("parses a well-formed response", () => {
    const raw = '```json\n{"objects":[{"type":"sofa","box":{"x":0.1,"y":0.5,"w":0.5,"h":0.3}}]}\n```';
    const out = parseCounterparts(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ type: "sofa", region: { x: 0.1, y: 0.5, w: 0.5, h: 0.3 } });
  });

  it("drops unknown types, tiny boxes and malformed rows", () => {
    const raw = JSON.stringify({
      objects: [
        { type: "spaceship", box: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } },
        { type: "rug", box: { x: 0.2, y: 0.7, w: 0.01, h: 0.5 } },
        { type: "table" },
        { type: "chair", box: { x: "0.4", y: "0.6", w: "0.2", h: "0.3" } },
      ],
    });
    const out = parseCounterparts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("chair");
  });

  it("keeps only the largest footprint per type", () => {
    const raw = JSON.stringify({
      objects: [
        { type: "sofa", box: { x: 0, y: 0, w: 0.2, h: 0.2 } },
        { type: "sofa", box: { x: 0.1, y: 0.5, w: 0.6, h: 0.3 } },
      ],
    });
    const out = parseCounterparts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].region.w).toBeCloseTo(0.6, 5);
  });

  it("returns [] on garbage — never throws", () => {
    expect(parseCounterparts("")).toEqual([]);
    expect(parseCounterparts("not json at all")).toEqual([]);
    expect(parseCounterparts("{\"objects\":\"nope\"}")).toEqual([]);
  });
});
