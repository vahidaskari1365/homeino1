// ============================================================
// FREE AGENT BLUEPRINT PACK — integrity tests
// Every blueprint must be runnable inside Homeino's own agent
// system: real tools only, valid permissions, no key collisions
// with built-ins, provenance (repo + license) always recorded,
// and every defaultToolPlan step must use a granted tool.
// ============================================================
import { describe, it, expect } from "vitest";
import { FREE_AGENT_BLUEPRINTS, BLUEPRINT_KEYS } from "./blueprints";
import { BUILTIN_AGENTS, TOOL_KEYS } from "./defaults";
import { AGENT_TYPES, AGENT_STATUSES, AGENT_RUNTIMES } from "./registry";
import { AGENT_PERMISSIONS } from "./permissions";
import { HANDLER_KEYS } from "./handlers";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/;

describe("free agent blueprint pack", () => {
  it("ships exactly the 6 documented GitHub-sourced agents", () => {
    expect(BLUEPRINT_KEYS).toEqual([
      "room-style-analyzer",
      "support-agent",
      "voice-of-customer",
      "persian-copywriter",
      "abandon-cart-recovery",
      "vendor-price-watcher",
    ]);
  });

  it("never collides with built-in agent keys", () => {
    const builtinKeys = new Set(BUILTIN_AGENTS.map((a) => a.key));
    for (const key of BLUEPRINT_KEYS) expect(builtinKeys.has(key)).toBe(false);
    expect(new Set(BLUEPRINT_KEYS).size).toBe(BLUEPRINT_KEYS.length);
  });

  it("records provenance for every agent (repo + license + URL)", () => {
    for (const b of FREE_AGENT_BLUEPRINTS) {
      expect(b.config.sourceRepo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(b.config.license).toBeTruthy();
      expect(b.config.sourceUrl).toMatch(/^https:\/\/github\.com\//);
      expect(b.config.adaptationNote.length).toBeGreaterThan(10);
    }
  });

  it("only uses REAL tools that exist in the builtin tool registry", () => {
    const known = new Set(TOOL_KEYS);
    for (const b of FREE_AGENT_BLUEPRINTS) {
      for (const tool of b.tools ?? []) expect(known.has(tool)).toBe(true);
    }
  });

  it("only grants permissions that exist in the permission registry", () => {
    const known = new Set<string>(AGENT_PERMISSIONS);
    for (const b of FREE_AGENT_BLUEPRINTS) {
      for (const p of b.permissions ?? []) expect(known.has(p)).toBe(true);
    }
  });

  it("uses valid enums + a resolvable handler", () => {
    for (const b of FREE_AGENT_BLUEPRINTS) {
      expect(AGENT_TYPES).toContain(b.type);
      expect(AGENT_STATUSES).toContain(b.status ?? "draft");
      expect(AGENT_RUNTIMES).toContain(b.runtime ?? "local");
      expect(b.handler ? HANDLER_KEYS.includes(b.handler) : true).toBe(true);
      expect(b.key).toMatch(KEY_RE);
      expect((b.name ?? "").length).toBeGreaterThan(0);
      expect((b.name ?? "").length).toBeLessThanOrEqual(160);
    }
  });

  it("keeps every defaultToolPlan step inside the agent's own grants", () => {
    for (const b of FREE_AGENT_BLUEPRINTS) {
      const plan = (b.config?.defaultToolPlan ?? []) as { tool: string }[];
      for (const step of plan) expect(b.tools ?? []).toContain(step.tool);
    }
  });

  it("stays honest without an LLM: 4 of 6 agents have a deterministic tool plan", () => {
    const withPlan = FREE_AGENT_BLUEPRINTS.filter((b) => Array.isArray(b.config?.defaultToolPlan) && (b.config!.defaultToolPlan as unknown[]).length > 0);
    expect(withPlan.length).toBe(4);
    // Honest exceptions BY DESIGN:
    //  • persian-copywriter — copywriting needs a model (honest refusal otherwise)
    //  • vendor-price-watcher — needs a real URL task + human approval
    expect(withPlan.map((b) => b.key)).not.toContain("persian-copywriter");
    expect(withPlan.map((b) => b.key)).not.toContain("vendor-price-watcher");
  });

  it("keeps destructive powers away from blueprints", () => {
    const dangerous = new Set(["updateProductPrice", "cancelOrder", "refundPayment", "deleteEntity"]);
    for (const b of FREE_AGENT_BLUEPRINTS) {
      for (const tool of b.tools ?? []) expect(dangerous.has(tool)).toBe(false);
    }
  });
});
