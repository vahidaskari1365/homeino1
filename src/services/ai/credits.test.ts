import { describe, expect, it } from "vitest";
import { AI_OPERATION_COSTS, CREDIT_CONFIG, costForMode, costOf } from "./credits";
import { CREDIT_DISPLAY, getDisplayCost, OPERATION_COSTS } from "../credits/ledger";

describe("credit costs — single source of truth", () => {
  it("exposes the same packages on CREDIT_CONFIG and CREDIT_DISPLAY", () => {
    expect(CREDIT_DISPLAY).toBe(CREDIT_CONFIG);
    expect(CREDIT_CONFIG.startingBalance).toBe(120);
    // aligned with the server PACKS + credit_packages seed (single price list)
    expect(CREDIT_CONFIG.buyPackages.map((p) => p.credits)).toEqual([50, 120, 300]);
  });

  it("keeps operation costs aligned between AI and ledger", () => {
    expect(OPERATION_COSTS).toEqual(AI_OPERATION_COSTS);
    expect(costOf("generate")).toBe(5);
    expect(costOf("edit")).toBe(3);
    expect(costOf("placement")).toBe(4);
    expect(getDisplayCost("generate")).toBe(5);
    expect(getDisplayCost("unknown-op")).toBe(5);
  });

  it("falls back to 5 for unknown AI modes", () => {
    expect(costForMode("not-a-mode")).toBe(5);
  });
});
