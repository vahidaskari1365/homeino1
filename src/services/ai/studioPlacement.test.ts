// ============================================================
// HOMINO STUDIO — PRODUCT REPLACEMENT ENGINE TESTS
// Deterministic size analysis, counterpart replacement planning,
// luminaire light projection.
// ============================================================
import { describe, it, expect } from "vitest";
import {
  planReplacementPlacements,
  analyzePlacementSize,
  type StudioProductInput,
} from "./studioPlacement";

const sofa: StudioProductInput = {
  id: "p1",
  name: "مبل راحتی مدل آریا",
  category: "furniture",
};

const chandelier: StudioProductInput = {
  id: "p9",
  name: "لوستر سقفی مدرن",
  category: "lighting",
  description: "دارای ۶۰ وات نور گرم با طراحی شاخه‌ای",
};

const rug: StudioProductInput = {
  id: "p12",
  name: "فرش ماشینی ۲۵۰",
  category: "carpet",
  dimensions: { width: 250, height: 200 },
};

describe("planReplacementPlacements — size analysis", () => {
  it("sizes a sofa from the category reference (220cm over a 420cm living scene)", () => {
    const [plan] = planReplacementPlacements([sofa], { roomType: "living" });
    expect(plan).toBeTruthy();
    // 220/420 ≈ 0.524 of the image width — no distortion
    expect(plan.widthPct).toBeCloseTo(220 / 420, 2);
    expect(plan.widthPct).toBeGreaterThan(0.4);
    expect(plan.widthPct).toBeLessThan(0.7);
    expect(plan.sizeReport).toContain("آنالیز");
    expect(plan.sizeReport).toContain("بدون تغییر اندازه");
  });

  it("prefers REAL product dimensions over category defaults", () => {
    const wide = { ...sofa, dimensions: { width: 300, height: 90 } };
    const [plan] = planReplacementPlacements([wide], { roomType: "living" });
    expect(plan.widthPct).toBeCloseTo(300 / 420, 2);
    expect(plan.sizeReport).toContain("واقعی");
  });

  it("clamps extreme sizes into the visible frame", () => {
    const huge = { ...sofa, dimensions: { width: 1200, height: 200 } };
    const [plan] = planReplacementPlacements([huge], { roomType: "kitchen" });
    expect(plan.widthPct).toBeLessThanOrEqual(0.92);
    expect(plan.heightPct).toBeLessThanOrEqual(0.95);
  });
});

describe("planReplacementPlacements — counterpart replacement", () => {
  it("anchors a sofa on the floor zone, centered on the living focal point", () => {
    const [plan] = planReplacementPlacements([sofa], { roomType: "living" });
    expect(plan.anchor).toBe("floor");
    const cx = plan.targetRegion.x + plan.targetRegion.width / 2;
    const cy = plan.targetRegion.y + plan.targetRegion.height / 2;
    expect(cx).toBeCloseTo(0.46, 2);
    expect(cy).toBeCloseTo(0.68, 2);
    expect(plan.rationale).toContain("مبلی که در عکس هست");
  });

  it("replaces EVERY selected product with its own analyzed spot", () => {
    const plans = planReplacementPlacements([sofa, rug, chandelier], { roomType: "living" });
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.productId)).toEqual(["p1", "p12", "p9"]);
  });

  it("keeps SAME-LAYER regions collision-free — a rug intentionally layers under the sofa", () => {
    const sofa2: StudioProductInput = { id: "p2", name: "مبل کلاسیک مدل بهار", category: "furniture" };
    const plans = planReplacementPlacements([sofa, sofa2, chandelier, rug], { roomType: "living" });
    const regionOf = (id: string) => plans.find((p) => p.productId === id)!.targetRegion;

    // Two sofas share the floor layer → they must be pushed apart.
    const a = regionOf("p1");
    const b = regionOf("p2");
    const overlap =
      a.x < b.x + b.width - 0.01 &&
      a.x + a.width > b.x + 0.01 &&
      a.y < b.y + b.height - 0.01 &&
      a.y + a.height > b.y + 0.01;
    expect(overlap).toBe(false);

    // The rug (ground layer) KEEPS its natural under-sofa spot — no weird nudge.
    const rugPlan = plans.find((p) => p.productId === "p12")!;
    expect(rugPlan.anchor).toBe("ground");
    expect(rugPlan.targetRegion.x + rugPlan.targetRegion.width / 2).toBeCloseTo(0.46, 2);
  });

  it("squashes ground-plane items (rug) for floor perspective", () => {
    const plans = planReplacementPlacements([rug], { roomType: "living" });
    expect(plans[0].anchor).toBe("ground");
    expect(plans[0].squash).toBeCloseTo(0.5, 2);
  });

  it("is deterministic — same input, same plan", () => {
    const a = planReplacementPlacements([sofa, rug], { roomType: "living" });
    const b = planReplacementPlacements([sofa, rug], { roomType: "living" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns an empty plan list for an empty selection", () => {
    expect(planReplacementPlacements([])).toEqual([]);
  });
});

describe("planReplacementPlacements — luminaire light projection", () => {
  it("anchors a chandelier on the ceiling and projects a warm glow", () => {
    const [plan] = planReplacementPlacements([chandelier], { roomType: "living" });
    expect(plan.anchor).toBe("ceiling");
    const cy = plan.targetRegion.y + plan.targetRegion.height / 2;
    expect(cy).toBeLessThan(0.3);
    expect(plan.glow).toBeTruthy();
    expect(plan.glow!.color).toBe("#FFD9A3");
    expect(plan.glow!.warmth).toBe("گرم");
    expect(plan.glow!.radiusPct).toBeGreaterThan(plan.widthPct);
    expect(plan.rationale).toContain("لوستر");
  });

  it("derives brightness from the product description (watt)", () => {
    const [plan] = planReplacementPlacements([chandelier], { roomType: "living" });
    // 60W → 0.35 + 60/130 ≈ 0.81 → clamped to 0.8
    expect(plan.glow!.intensity).toBeCloseTo(0.8, 1);
    expect(plan.sizeReport).toContain("نور");
  });

  it("treats every selected luminaire as an emitter, not only the first", () => {
    const plans = planReplacementPlacements([chandelier, { ...chandelier, id: "p10", name: "آباژور ایستاده کلاسیک", description: "۴۰ وات" }], { roomType: "living" });
    expect(plans[0].glow).toBeTruthy();
    expect(plans[1].glow).toBeTruthy();
  });
});

describe("analyzePlacementSize", () => {
  it("uses scene width per room type", () => {
    const fit = { w: 220, h: 85, anchor: "floor" as const, cx: 0.46, cy: 0.68, rationale: "r" };
    const living = analyzePlacementSize(sofa, fit, "living");
    const bedroom = analyzePlacementSize(sofa, fit, "bedroom");
    expect(living.widthPct).toBeCloseTo(220 / 420, 2);
    expect(bedroom.widthPct).toBeCloseTo(220 / 380, 2);
    expect(living.usedRealDimensions).toBe(false);
  });
});
