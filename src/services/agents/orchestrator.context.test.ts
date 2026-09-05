import { describe, expect, it } from "vitest";
import { parseProductContext } from "./orchestrator";

// The AI panel's product context must survive both the legacy format
// (id + sku) and the new format that also carries the slug — the slug is
// what lets the server resolve DB-only products (vendor-added items).
describe("parseProductContext", () => {
  it("parses the legacy id+sku format", () => {
    const ctx = parseProductContext("محصول: مبل سلطنتی نعنایی (id: p1، sku: SOF-1024)");
    expect(ctx).not.toBeNull();
    expect(ctx!.name).toBe("مبل سلطنتی نعنایی");
    expect(ctx!.id).toBe("p1");
    expect(ctx!.sku).toBe("SOF-1024");
    expect(ctx!.slug).toBe("");
  });

  it("parses the new id+sku+slug format", () => {
    const ctx = parseProductContext("محصول: مبل سلطنتی نعنایی (id: a1b2، sku: SOF-1024، slug: sofa-royal)");
    expect(ctx!.id).toBe("a1b2");
    expect(ctx!.sku).toBe("SOF-1024");
    expect(ctx!.slug).toBe("sofa-royal");
  });

  it("parses a slug-only context (DB-only product on a PDP)", () => {
    const ctx = parseProductContext("محصول: sofa-new-arrival (slug: sofa-new-arrival)");
    expect(ctx!.name).toBe("sofa-new-arrival");
    expect(ctx!.slug).toBe("sofa-new-arrival");
    expect(ctx!.id).toBe("");
    expect(ctx!.sku).toBe("");
  });

  it("returns null for non-product contexts", () => {
    expect(parseProductContext("صفحه اصلی Homeino")).toBeNull();
    expect(parseProductContext(undefined)).toBeNull();
  });
});
