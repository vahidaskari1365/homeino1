// ============================================================
// PHASE 3 — seeded agents + workflows SMOKE suite (no keys, no DB).
//
// Runs EVERY built-in agent and the three seeded workflows with real Persian
// inputs in heuristic mode and asserts:
//   • nothing throws and no AGENT_NOT_FOUND leaks to the output
//   • every run has a valid shape (dataState + Persian text and/or products)
//   • any product reference is a real catalog product (never fabricated)
//
// Run standalone via `npm run test:agents`; also loads with `npm run test:ai`.
// ============================================================
import assert from "node:assert/strict";
import test from "node:test";

import { ensureSeeded, storeMode } from "../../src/services/agents/store";
import { runAgentByKey } from "../../src/services/agents/runtime";
import { executeWorkflowByKey } from "../../src/services/workflows/engine";
import { findCatalogProduct } from "../../src/services/agents/catalog";
import type { AgentRunResult } from "../../src/services/agents/types";

const DATA_STATES = ["ok", "not_enough_data", "no_data", "degraded"];

/** Runs must be honest: never AGENT_NOT_FOUND, never a thrown handler error. */
function assertRunShape(result: AgentRunResult, label: string) {
  assert.ok(result, `${label}: no run result`);
  assert.notEqual(result.errorCode, "AGENT_NOT_FOUND", `${label}: AGENT_NOT_FOUND`);
  assert.ok(typeof result.agentKey === "string" && result.agentKey.length > 0, `${label}: agentKey missing`);
  assert.ok(result.output && typeof result.output === "object", `${label}: output is not an object`);
  const output = result.output as Record<string, unknown>;
  assert.ok(DATA_STATES.includes(String(output.dataState)), `${label}: dataState=${output.dataState}`);
  assert.ok(result.ok || result.status === "waiting_approval", `${label}: run failed (${result.errorCode}: ${result.error})`);
}

/** Product lists must point at the real catalog only. */
function assertRealProducts(products: unknown[], label: string) {
  for (const product of products as { id?: string; productId?: string; sku?: string }[]) {
    const id = product?.id ?? product?.productId;
    assert.ok(id, `${label}: product without id`);
    assert.ok(findCatalogProduct({ id: String(id) }), `${label}: fabricated product ${id}`);
  }
}

function agentProducts(result: AgentRunResult): unknown[] {
  const output = result.output as Record<string, unknown>;
  const list = Array.isArray(output.products) ? (output.products as unknown[]) : Array.isArray(output.matchedProducts) ? (output.matchedProducts as unknown[]) : Array.isArray(output.items) ? (output.items as unknown[]) : [];
  return list;
}

test("smoke: every seeded agent runs with Persian input in heuristic mode", async () => {
  await ensureSeeded();
  assert.notEqual(storeMode(), "database", "smoke must run on the in-memory store");

  const cases: { key: string; label: string; input: Record<string, unknown> }[] = [
    {
      key: "shopping-assistant",
      label: "shopping-assistant",
      input: { query: "یه فرش مدرن برای پذیرایی می‌خوام زیر ۱۵ میلیون" },
    },
    {
      key: "designer",
      label: "designer",
      input: { room: "bedroom", roomType: "bedroom", style: "japandi", limit: 6 },
    },
    {
      key: "recommendation",
      label: "recommendation",
      input: { scenario: "product_detail", seedProductId: "p1", limit: 5, userId: "smoke-customer-1", note: "پیشنهاد محصولات مشابه واقعی" },
    },
    {
      key: "customer-intelligence",
      label: "customer-intelligence",
      input: { userId: "smoke-user-1", sessionId: "smoke-session-1" },
    },
    {
      key: "inventory",
      label: "inventory",
      input: { threshold: 5, userId: "smoke-admin" },
    },
  ];

  for (const { key, label, input } of cases) {
    const result = await runAgentByKey(key, { input, userId: "smoke-user-1", sessionId: "smoke-session-1" });
    assertRunShape(result, label);
    const products = agentProducts(result);
    if (products.length) assertRealProducts(products, label);

    // The Persian answer/summary must be present whenever there is content.
    const text = String((result.output as Record<string, unknown>).answer ?? (result.output as Record<string, unknown>).summary ?? (result.output as Record<string, unknown>).message ?? "").trim();
    assert.ok(!result.ok || text.length > 0 || products.length > 0, `${label}: no answer/summary and no products`);
  }
});

test("smoke: the three seeded workflows complete without AGENT_NOT_FOUND", async () => {
  await ensureSeeded();
  const workflows = ["customer-view-intelligence", "wishlist-similar-products", "low-stock-audit"] as const;

  for (const key of workflows) {
    const result = await executeWorkflowByKey(key, {
      triggerKind: "manual",
      triggerPayload: { note: "اجرای تستی دود (smoke) بدون دیتابیس", by: "agents-smoke" },
    });
    assert.ok(result, `${key}: no result`);
    assert.ok(result.runId, `${key}: runId missing`);
    assert.ok(Array.isArray(result.steps), `${key}: steps missing`);
    const notFound = result.steps.filter((s) => typeof s.error === "string" && s.error.includes("AGENT_NOT_FOUND"));
    assert.deepEqual(notFound, [], `${key}: AGENT_NOT_FOUND in ${notFound.length} steps`);
    const errors = result.steps.filter((s) => typeof s.error === "string" && !s.error.includes("AGENT_NOT_FOUND"));
    assert.deepEqual(errors, [], `${key}: step errors -> ${JSON.stringify(errors[0] ?? null)}`);
  }
});

test("smoke: Persian normalization — Arabic ي/ك + ZWNJ still finds real products", async () => {
  await ensureSeeded();
  const result = await runAgentByKey("shopping-assistant", {
    input: { query: "مي‌خوام يک ميز جلو مبلي چوبي پيدا کنم" },
    sessionId: "smoke-session-norm",
  });
  assertRunShape(result, "normalized Persian query");
  const products = agentProducts(result);
  assert.ok(products.length > 0, "no products for the normalized query");
  assertRealProducts(products, "normalized Persian query");
});
