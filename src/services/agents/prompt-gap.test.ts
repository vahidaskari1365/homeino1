// ============================================================
// HOMEINO — PROMPT GAP TESTS: vendor / marketing / development
//
// The agentic prompt (Stage 4 + Stage 6) requires these three agents
// and the getVendor / getStore / runWorkflow tools. This file pins
// their contracts at the public seams only:
//   • TOOL_DEFINITIONS registry (keys, permission, approval flags)
//   • AGENT_HANDLERS resolution
//   • BUILTIN_AGENTS integrity (grants ⊆ registry, handler exists)
//   • handler behavior through a fake HandlerContext
// ============================================================
import { describe, it, expect, vi } from "vitest";
import { TOOL_DEFINITIONS, getTool } from "./tools";
import { BUILTIN_AGENTS, BUILTIN_TOOLS, TOOL_KEYS } from "./defaults";
import { AGENT_HANDLERS, resolveHandler } from "./handlers";
import { AGENT_PERMISSIONS } from "./permissions";
import { runVendorAgent } from "./handlers/vendor";
import { runMarketingAgent } from "./handlers/marketing";
import { runDevelopmentAgent } from "./handlers/development";
import type { HandlerContext, ToolCallResult } from "./handlers/types";

// ----------------------------------------------------------
// Registry integrity (Stage 6: getVendor / getStore / runWorkflow)
// ----------------------------------------------------------
describe("prompt-required tools", () => {
  it("registers getVendor with READ_VENDORS and no approval", () => {
    const tool = getTool("getVendor");
    expect(tool).toBeDefined();
    expect(tool!.requiredPermission).toBe("READ_VENDORS");
    expect(tool!.requiresApproval ?? false).toBe(false);
    expect(tool!.isDestructive ?? false).toBe(false);
  });

  it("registers getStore with READ_VENDORS and no approval", () => {
    const tool = getTool("getStore");
    expect(tool).toBeDefined();
    expect(tool!.requiredPermission).toBe("READ_VENDORS");
  });

  it("registers runWorkflow as WRITE_TASKS, not destructive", () => {
    const tool = getTool("runWorkflow");
    expect(tool).toBeDefined();
    expect(tool!.requiredPermission).toBe("WRITE_TASKS");
    expect(tool!.isDestructive ?? false).toBe(false);
  });

  it("keeps defaults.ts and tools.ts registries in sync", () => {
    const execKeys = new Set(TOOL_DEFINITIONS.map((t) => t.key));
    const metaKeys = new Set(BUILTIN_TOOLS.map((t) => t.key));
    for (const key of ["getVendor", "getStore", "runWorkflow"]) {
      expect(execKeys.has(key)).toBe(true);
      expect(metaKeys.has(key)).toBe(true);
      expect(TOOL_KEYS).toContain(key);
    }
    expect(execKeys.size).toBe(metaKeys.size);
  });
});

// ----------------------------------------------------------
// Builtin agent integrity (Stage 4: vendor / marketing / development)
// ----------------------------------------------------------
describe("prompt-required agents", () => {
  it("seeds vendor-agent, marketing-agent and development-agent", () => {
    const keys = BUILTIN_AGENTS.map((a) => a.key);
    expect(keys).toContain("vendor-agent");
    expect(keys).toContain("marketing-agent");
    expect(keys).toContain("development-agent");
  });

  it("grants only registry permissions and registry tools", () => {
    const perms = new Set<string>(AGENT_PERMISSIONS);
    const tools = new Set<string>(TOOL_KEYS);
    for (const agent of BUILTIN_AGENTS) {
      for (const p of agent.permissions ?? []) expect(perms.has(p)).toBe(true);
      for (const t of agent.tools ?? []) expect(tools.has(t)).toBe(true);
    }
  });

  it("maps the three new agents to resolvable handlers", () => {
    for (const key of ["vendor-agent", "marketing-agent", "development-agent"]) {
      const agent = BUILTIN_AGENTS.find((a) => a.key === key)!;
      expect(agent.handler).toBeTruthy();
      expect(AGENT_HANDLERS[agent.handler!]).toBeDefined();
      expect(resolveHandler(agent.handler!)).toBeDefined();
    }
  });

  it("never grants a destructive permission to the new agents", () => {
    const danger = new Set(["DELETE", "PAYMENT", "REFUND", "ORDER_CANCEL", "DATABASE_DESTRUCTIVE_WRITE", "WRITE_PRODUCTS"]);
    for (const key of ["vendor-agent", "marketing-agent", "development-agent"]) {
      const agent = BUILTIN_AGENTS.find((a) => a.key === key)!;
      for (const p of agent.permissions ?? []) expect(danger.has(p)).toBe(false);
    }
  });
});

// ----------------------------------------------------------
// Fake handler context
// ----------------------------------------------------------
interface FakeSpec {
  toolResults?: Record<string, ToolCallResult>;
  approvalId?: string | null;
}

function makeCtx(spec: FakeSpec = {}): HandlerContext & { calls: { tool: string; input?: Record<string, unknown> }[]; approvals: string[] } {
  const calls: { tool: string; input?: Record<string, unknown> }[] = [];
  const approvals: string[] = [];
  const ctx: HandlerContext & { calls: typeof calls; approvals: typeof approvals } = {
    calls,
    approvals,
    agent: { key: "test", name: "test", type: "analyzer", config: {} } as HandlerContext["agent"],
    userId: "user-1",
    sessionId: null,
    runId: "run-1",
    taskId: null,
    actorRole: "system",
    permissions: ["READ_VENDORS", "READ_PRODUCTS", "READ_INVENTORY", "READ_ORDERS", "READ_CUSTOMERS", "READ_ANALYTICS", "WRITE_TASKS", "SEND_NOTIFICATION", "REQUEST_APPROVAL", "CALL_LLM"],
    grantedTools: ["getVendor", "getStore", "searchProducts", "getInventory", "getLowStockProducts", "getCustomerEvents", "getOrders", "getCustomer", "getCustomerPreferences", "createTask", "sendNotification", "requestApproval", "llmComplete", "runWorkflow"],
    async callTool(key, input) {
      calls.push({ tool: key, input });
      const custom = spec.toolResults?.[key];
      if (custom) return custom;
      if (key === "createTask") return { ok: true, data: { taskId: `task-${calls.length}` } };
      if (key === "requestApproval") return { ok: true, data: { approvalId: spec.approvalId ?? "approval-1" } };
      if (key === "llmComplete") return { ok: true, data: { text: "پلن تستی" } };
      return { ok: true, data: {} };
    },
    log: vi.fn(),
    addUsage: vi.fn(),
    async requestApproval(action, reason) {
      approvals.push(`${action}:${reason}`);
      return spec.approvalId === null ? null : (spec.approvalId ?? "approval-1");
    },
    context: {},
  };
  return ctx;
}

// ----------------------------------------------------------
// Vendor Agent (Stage 4.5)
// ----------------------------------------------------------
describe("vendor agent handler", () => {
  it("reads a real vendor and reports performance", async () => {
    const ctx = makeCtx({
      toolResults: {
        getVendor: {
          ok: true,
          data: {
            found: true,
            vendor: { id: "v1", name: "فروشگاه مبل ایرانیان", slug: "iran-sofa", rating: 4.6, salesCount: 120, productCount: 34 },
          },
        },
        getStore: { ok: true, data: { found: true, store: { id: "v1", name: "فروشگاه مبل ایرانیان" } } },
        searchProducts: { ok: true, data: { count: 3, items: [{ id: "p1", name: "مبل", price: 1000, stockCount: 2 }, { id: "p2", name: "میز", price: 500, stockCount: 9 }, { id: "p3", name: "کتان", price: 800, stockCount: 4 }] } },
        getInventory: { ok: true, data: { stockCount: 2, lowStock: true } },
      },
    });
    const result = await runVendorAgent({ vendorSlug: "iran-sofa" }, ctx);
    expect(result.dataState).toBe("ok");
    expect(result.output.vendor).toMatchObject({ id: "v1" });
    expect(ctx.calls.some((c) => c.tool === "getVendor")).toBe(true);
    expect(ctx.calls.some((c) => c.tool === "createTask")).toBe(true);
  });

  it("reports no_data honestly when the vendor does not exist", async () => {
    const ctx = makeCtx({ toolResults: { getVendor: { ok: true, data: { found: false } } } });
    const result = await runVendorAgent({ vendorSlug: "ghost" }, ctx);
    expect(result.dataState).toBe("no_data");
    expect(ctx.calls.some((c) => c.tool === "createTask")).toBe(false);
  });
});

// ----------------------------------------------------------
// Marketing Agent (Stage 4.6) — drafts only, approval mandatory
// ----------------------------------------------------------
describe("marketing agent handler", () => {
  it("produces segments + draft campaigns and requests human approval", async () => {
    const ctx = makeCtx({
      toolResults: {
        getCustomerEvents: { ok: true, data: { count: 2, events: [{ type: "product_view", userId: "u1" }, { type: "product_search", userId: "u2" }] } },
      },
    });
    const result = await runMarketingAgent({}, ctx);
    expect(result.output.segments).toBeDefined();
    expect(Array.isArray(result.output.drafts)).toBe(true);
    expect(ctx.approvals.length).toBeGreaterThan(0);
    // absolutely no direct send: campaigns wait for the human decision
    expect(ctx.calls.some((c) => c.tool === "sendNotification")).toBe(false);
  });
});

// ----------------------------------------------------------
// Development Agent (Stage 4.8) — plan-only, no production writes
// ----------------------------------------------------------
describe("development agent handler", () => {
  it("turns a dev task into an approved plan + tracked task", async () => {
    const ctx = makeCtx({
      toolResults: {
        llmComplete: { ok: true, data: { json: { summary: "افزودن تست", files: ["src/a.ts"], steps: ["تست", "پیاده‌سازی"], risks: ["کم"], tests: ["unit"] } } },
      },
    });
    const result = await runDevelopmentAgent({ task: "تست برای ماژول A بنویس" }, ctx);
    expect(result.dataState).toBe("ok");
    expect(result.output.plan).toMatchObject({ summary: "افزودن تست" });
    expect(ctx.calls.some((c) => c.tool === "createTask")).toBe(true);
    expect(ctx.approvals.length).toBeGreaterThan(0);
  });

  it("fails honestly without a task description", async () => {
    const ctx = makeCtx();
    const result = await runDevelopmentAgent({}, ctx);
    expect(result.dataState).toBe("no_data");
    expect(ctx.calls.some((c) => c.tool === "llmComplete")).toBe(false);
  });
});
