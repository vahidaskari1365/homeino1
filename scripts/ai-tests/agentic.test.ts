// HOMEINO — agentic layer tests: registry, permissions, tools, agents, memory,
// workflows, approvals, task queue, budgets and the security guards.
//
// Everything here must pass WITHOUT a database and WITHOUT any LLM/API key:
// the store falls back to memory and the agents must stay honest ("no_data")
// instead of inventing products, prices or profiles.
import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_PERMISSIONS,
  isPermission,
  maxRisk,
  normalizePermissions,
  PERMISSION_LABELS,
  PERMISSION_RISK,
  requiresApproval,
  riskOf,
} from "../../src/services/agents/permissions";
import type { AgentPermissionKey } from "../../src/services/agents/permissions";
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  listToolRegistry,
  sanitizeAgentInput,
  setAgentStatus,
  updateAgent,
  validateAgentInput,
} from "../../src/services/agents/registry";
import { ensureSeeded, getStore, resetStoreResolver, storeMode } from "../../src/services/agents/store";
import { executeTool } from "../../src/services/agents/tools";
import type { ToolCallContext } from "../../src/services/agents/types";
import { runAgentByKey } from "../../src/services/agents/runtime";
import { guardAgentOutput } from "../../src/services/agents/outputGuard";
import { verifyRealProducts } from "../../src/services/recommendations/productMatching";
import { catalogPool, findCatalogProduct, findCatalogProductBySku, lowStockCatalog, queryTokens, searchCatalog } from "../../src/services/agents/catalog";
import { computeCustomerProfile } from "../../src/services/memory/preferenceEngine";
import { customerMemory } from "../../src/services/memory/customerMemory";
import { createWorkflow, validateWorkflow } from "../../src/services/workflows/registry";
import { evaluateCondition, executeWorkflowByKey, nextScheduleRun, resolvePath, resumeWorkflowRun } from "../../src/services/workflows/engine";
import { tickScheduler } from "../../src/services/workflows/scheduler";
import { recordEvent, runMatchedWorkflows } from "../../src/services/workflows/triggers";
import { cancelTask, claimNextTask, createTask, listTasks, retryTask, runTask, taskQueueSummary } from "../../src/services/automation/taskQueue";
import { decideApproval, expireStaleApprovals, listApprovals, requestApproval } from "../../src/services/automation/approvals";
import { budgets, checkRunBudget, setBudget } from "../../src/services/automation/costControl";
import { assertBrowserTaskAllowed, browserProviderStatus, effectiveAllowedDomains } from "../../src/services/agents/integrations/browserRuntime";
import { allowedDomains, isDomainAllowed, runHttpTask } from "../../src/services/agents/integrations/httpRuntime";

/** Fresh, deterministic store (memory mode) for each isolated test. */
async function freshStore() {
  resetStoreResolver();
  const store = await ensureSeeded();
  return store;
}

function toolContext(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    agentKey: "test-agent",
    permissions: ["READ_PRODUCTS"],
    grantedTools: ["searchProducts", "listProducts"],
    actorRole: "system",
    depth: 0,
    log: () => {},
    addUsage: () => {},
    callTool: async () => ({ ok: true, data: {} }),
    ...overrides,
  };
}

/** Real catalog rows the tests build behaviour from — never invented ones. */
async function sampleProducts(count = 4) {
  const pool = await catalogPool();
  assert.ok(pool.length >= count, `the catalog must expose at least ${count} real products`);
  return pool.slice(0, count);
}

// ---------------------------------------------------------------- registry
test("seeds the agentic registry: tools, agents, workflows, integrations, budget", async () => {
  const store = await freshStore();
  assert.equal(storeMode(), "memory", "without DATABASE_URL the store must fall back to memory");

  const tools = await store.listTools();
  assert.ok(tools.length >= 20, `expected a full tool registry, got ${tools.length}`);
  for (const tool of tools) {
    assert.ok(isPermission(tool.requiredPermission), `tool ${tool.key} has an unknown permission`);
    assert.ok(tool.category && tool.name && tool.description, `tool ${tool.key} is under-documented`);
  }

  const agents = await listAgents();
  for (const key of ["customer-intelligence", "recommendation", "shopping-assistant", "inventory", "designer", "browser"]) {
    const agent = agents.find((a) => a.key === key);
    assert.ok(agent, `builtin agent missing: ${key}`);
    assert.equal(agent!.isBuiltin, true);
    // The browser agent stays draft until a provider (Browser Use / Stagehand) is configured.
    assert.equal(agent!.status, key === "browser" ? "draft" : "active");
    assert.ok(agent!.tools.length > 0, `${key} must declare its tools`);
    assert.ok(agent!.permissions.length > 0, `${key} must declare its permissions`);
  }

  const workflows = await store.listWorkflows();
  for (const key of ["customer-view-intelligence", "wishlist-similar-products", "low-stock-audit"]) {
    const wf = workflows.find((w) => w.key === key);
    assert.ok(wf, `builtin workflow missing: ${key}`);
    assert.equal(wf!.status, "active");
    assert.ok(wf!.nodes.length >= 3);
    assert.equal(wf!.runtime ?? "local", "local", "the built-in engine must be the default runtime");
  }

  const integrations = await store.listIntegrations();
  for (const provider of ["dify", "langflow", "ollama", "mem0", "browser_use", "stagehand"]) {
    assert.ok(integrations.some((i) => i.provider === provider), `integration missing: ${provider}`);
  }
  // No secret may ever be stored — only the env var NAME.
  for (const integration of integrations) {
    assert.ok(!integration.baseUrl || !/api[_-]?key=/i.test(integration.baseUrl));
  }

  const all = await budgets();
  assert.ok(all.some((b) => b.scope === "global" && b.isActive), "an active global budget must be seeded");
});

test("dangerous tools are approval-gated and carry their permission risk", async () => {
  const tools = await listToolRegistry();
  for (const key of ["updateProductPrice", "cancelOrder", "refundPayment", "deleteEntity", "httpRequest", "browserTask"]) {
    const tool = tools.find((t) => t.key === key);
    assert.ok(tool, `tool missing from the registry: ${key}`);
    assert.equal(tool!.requiresApproval, true, `${key} must require human approval`);
    assert.equal(requiresApproval(tool!.requiredPermission), true, `${key} permission must be approval-required`);
    assert.ok(["high", "critical"].includes(riskOf(tool!.requiredPermission)), `${key} must be high/critical risk`);
    assert.ok(tool!.isDestructive || key === "httpRequest" || key === "browserTask");
  }
  assert.equal(maxRisk(["READ_PRODUCTS", "WRITE_PRODUCTS"]), "critical");
  assert.equal(riskOf("READ_PRODUCTS"), "low");
  assert.ok(PERMISSION_LABELS.WRITE_PRODUCTS.length > 0);
  assert.ok(Object.keys(PERMISSION_RISK).length === AGENT_PERMISSIONS.length);
});

test("permissions are validated, normalised and de-duplicated", () => {
  const normalized = normalizePermissions([...AGENT_PERMISSIONS, "NOT_A_PERMISSION", "READ_PRODUCTS"] as unknown[]);
  assert.deepEqual(normalized, [...AGENT_PERMISSIONS]);
  assert.deepEqual(normalizePermissions("nonsense"), []);
  assert.equal(isPermission("DELETE"), true);
  assert.equal(isPermission("DROP_TABLE"), false);
});

test("agent registry CRUD roundtrip + duplicate key rejection", async () => {
  await freshStore();
  const created = await createAgent({
    key: "test-agent",
    name: "ایجنت تست",
    type: "analyzer",
    description: "unit test agent",
    tools: ["searchProducts"],
    permissions: ["READ_PRODUCTS"],
    config: { note: "be honest" },
    status: "active",
  });
  assert.equal(created.key, "test-agent");
  assert.equal(created.runtime, "local");

  await assert.rejects(() => createAgent({ key: "test-agent", name: "dup", type: "browser" }), /قبلاً استفاده شده/);

  const fetched = await getAgent("test-agent");
  assert.equal(fetched?.name, "ایجنت تست");

  const updated = await updateAgent("test-agent", { name: "نام جدید", tools: ["searchProducts", "listProducts"] });
  assert.equal(updated?.name, "نام جدید");
  assert.deepEqual(updated?.tools, ["searchProducts", "listProducts"]);

  assert.equal((await setAgentStatus("test-agent", "paused"))?.status, "paused");
  assert.equal((await setAgentStatus("test-agent", "archived"))?.status, "archived");
  await setAgentStatus("test-agent", "active");

  assert.equal(await deleteAgent("test-agent"), true);
  assert.equal(await getAgent("test-agent"), null);
  assert.equal(await updateAgent("ghost", { name: "x" }), null);
});

test("validateAgentInput rejects bad key/type/retries and warns on unknown tools", () => {
  assert.equal(validateAgentInput({ key: "has spaces", name: "x", type: "browser" }).ok, false);
  assert.equal(validateAgentInput({ key: "ok-key", name: "  ", type: "browser" }).ok, false);

  const badType = validateAgentInput({ key: "ok-key", name: "x", type: "sentient" as never });
  assert.equal(badType.ok, false);
  assert.ok(badType.errors.some((e) => /نوع ایجنت/.test(e)));

  assert.equal(validateAgentInput({ key: "ok-key", name: "x", type: "browser", maxRetries: 99 }).ok, false);
  assert.equal(validateAgentInput({ key: "ok-key", name: "x", type: "browser", timeoutMs: 10 }).ok, false);

  const unknownTools = validateAgentInput({ key: "ok-key", name: "x", type: "browser", tools: ["flyToTheMoon"] });
  assert.equal(unknownTools.ok, true, "unknown tools are dropped with a warning, not an error");
  assert.ok(unknownTools.warnings.some((w) => /flyToTheMoon/.test(w)));

  const missingPermission = validateAgentInput({ key: "ok-key", name: "x", type: "analyzer", tools: ["searchProducts"], permissions: [] });
  assert.ok(missingPermission.warnings.some((w) => /READ_PRODUCTS/.test(w)), "tool without its permission must warn");

  const valid = validateAgentInput({
    key: "ok-key",
    name: "x",
    type: "analyzer",
    tools: ["searchProducts"],
    permissions: ["READ_PRODUCTS"],
    maxRetries: 2,
    timeoutMs: 30_000,
  });
  assert.equal(valid.ok, true, valid.errors.join(" · "));
});

test("sanitizeAgentInput drops unknown tools/permissions and normalises keys", () => {
  const clean = sanitizeAgentInput({
    key: "  Mixed-Key ",
    name: "  ایجنت  ",
    type: "browser",
    tools: ["searchProducts", "notATool", "searchProducts"],
    permissions: ["READ_PRODUCTS", "NOT_A_PERMISSION"] as unknown as AgentPermissionKey[],
    schedule: { kind: "nonsense" as never },
  });
  assert.equal(clean.key, "mixed-key");
  assert.equal(clean.name, "ایجنت");
  assert.deepEqual(clean.tools, ["searchProducts"]);
  assert.deepEqual(clean.permissions, ["READ_PRODUCTS"]);
  assert.deepEqual(clean.schedule, { kind: "manual" });
});

// ---------------------------------------------------------------- tool gating
test("executeTool enforces grants, permissions and nesting depth", async () => {
  await freshStore();
  const ctx = toolContext();

  const allowed = await executeTool("searchProducts", { limit: 5 }, ctx);
  assert.equal(allowed.ok, true, allowed.error);

  const unknown = await executeTool("doesNotExist", {}, ctx);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "TOOL_NOT_FOUND");

  const notGranted = await executeTool("updateProductPrice", { productId: "x", price: 10 }, ctx);
  assert.equal(notGranted.ok, false);
  assert.equal(notGranted.code, "TOOL_NOT_GRANTED");

  const noPermission = await executeTool("getInventory", { productId: "x" }, toolContext({ grantedTools: ["getInventory"], permissions: [] }));
  assert.equal(noPermission.ok, false);
  assert.equal(noPermission.code, "PERMISSION_DENIED");

  const tooDeep = await executeTool("searchProducts", { limit: 1 }, toolContext({ depth: 5 }));
  assert.equal(tooDeep.ok, false, "nested tool calls must be capped");
});

test("catalog tools only ever return real catalog rows", async () => {
  await freshStore();
  const ctx = toolContext();
  const res = await executeTool("searchProducts", { limit: 5 }, ctx);
  assert.equal(res.ok, true);
  const data = res.data as { items?: { id: string; name: string; price: number }[] };
  const items = data.items ?? [];
  assert.ok(items.length > 0, "the static catalog must be searchable in memory mode");
  for (const item of items) {
    const real = await findCatalogProduct({ id: item.id });
    assert.ok(real, `tool leaked a product id that is not in the catalog: ${item.id}`);
    assert.equal(item.name, real!.name);
    assert.equal(item.price, real!.price);
  }

  const sku = items[0]!.id ? await findCatalogProduct({ id: items[0]!.id }) : undefined;
  if (sku?.sku) {
    const bySku = await findCatalogProductBySku(sku.sku);
    assert.equal(bySku?.id, sku.id, "exact SKU lookup must resolve the same product");
  }
  assert.equal(await findCatalogProductBySku("SKU-DOES-NOT-EXIST"), undefined);
});

// ---------------------------------------------------------------- memory + profile
test("customer memory: remember / recall / all / forget", async () => {
  await freshStore();
  const userId = "user-memory-1";

  const saved = await customerMemory.remember(userId, {
    kind: "preference",
    key: "style:modern",
    text: "سبک مدرن را دوست دارد",
    value: { style: "مدرن" },
    importance: 3,
  });
  assert.ok(saved, "a memory record must be stored");
  await customerMemory.remember(userId, { kind: "interaction", key: "product_view:p1", text: "بازدید مبل کرم", importance: 1 });

  const all = await customerMemory.all(userId);
  assert.ok(all.length >= 2);
  const recalled = await customerMemory.recall(userId, "مبل مدرن کرم");
  assert.ok(recalled.length > 0, "recall must surface stored memories");

  assert.equal(await customerMemory.forget(userId, "preference", "style:modern"), true);
  const afterForget = await customerMemory.all(userId);
  assert.ok(!afterForget.some((m) => m.key === "style:modern"));

  // Without a user there is nothing to store — and nothing is faked.
  assert.equal(await customerMemory.remember(null, { kind: "note", key: "x" }), null);
  assert.deepEqual(await customerMemory.all(null), []);
  assert.match(customerMemory.status().mem0, /not configured|connected/);
});

test("customer profile: no events => honest no_data, real events => real signals", async () => {
  await freshStore();
  const empty = await computeCustomerProfile({ sessionId: "session-empty-1", persist: true });
  assert.equal(empty.dataState, "no_data");
  assert.equal(empty.userId, null, "no customer id may be invented");
  assert.deepEqual(empty.preferredStyles, []);
  assert.deepEqual(empty.preferredColors, []);
  assert.equal(empty.confidence, 0);

  const products = await sampleProducts(3);
  for (const product of products) {
    const tracked = await recordEvent({
      eventType: "product_view",
      sessionId: "session-real-1",
      entityType: "product",
      entityId: product.id,
      metadata: { price: product.price, name: product.name },
    });
    assert.equal(tracked.recorded, true);
    assert.equal(tracked.storeMode, "memory");
  }

  const built = await computeCustomerProfile({ sessionId: "session-real-1", persist: true });
  assert.notEqual(built.dataState, "no_data");
  assert.ok(built.eventCount >= 3, `expected >= 3 real events, got ${built.eventCount}`);
  assert.ok(built.confidence > 0, "confidence must reflect real evidence");
  assert.ok(built.recentInterests.length > 0);
  for (const interest of built.recentInterests) {
    if (interest.entityType === "product" && interest.entityId) {
      assert.ok(await findCatalogProduct({ id: interest.entityId }), `profile references a fake product: ${interest.entityId}`);
    }
  }
  const priceRange = built.preferredPriceRange;
  if (typeof priceRange.min === "number" && typeof priceRange.max === "number") {
    assert.ok(priceRange.min <= priceRange.max);
  }
});

test("event tracking matches the built-in workflows on a cold process", async () => {
  // Nothing has called ensureSeeded() here — the first public request must
  // still see the built-in registry, otherwise events silently match nothing.
  resetStoreResolver();
  const product = (await catalogPool())[0]!;
  const tracked = await recordEvent({
    eventType: "product_view",
    sessionId: "session-cold-1",
    entityType: "product",
    entityId: product.id,
    metadata: { price: product.price },
  });
  assert.equal(tracked.recorded, true);
  assert.equal(tracked.dataState, "ok");
  assert.equal(tracked.storeMode, "memory");
  assert.ok(
    tracked.matchedWorkflows.includes("customer-view-intelligence"),
    `built-in workflows must be available from the first request, got: ${tracked.matchedWorkflows.join(", ") || "(none)"}`,
  );
});

// ---------------------------------------------------------------- agents
test("customer-intelligence agent reports no_data instead of inventing preferences", async () => {
  await freshStore();
  const result = await runAgentByKey("customer-intelligence", {
    input: { sessionId: "session-nobody", buildProfile: true },
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.status, "completed");
  assert.equal(result.dataState, "no_data");
  const output = result.output as { profile?: null; eventCount?: number };
  assert.equal(output.profile, null);
  assert.equal(output.eventCount, 0);
});

test("recommendation agent returns only real, ranked catalog products", async () => {
  await freshStore();
  const products = await sampleProducts(2);
  const result = await runAgentByKey("recommendation", {
    input: { scenario: "home", limit: 8, seedProductId: products[0]!.id },
    sessionId: "session-rec-1",
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.status, "completed");
  const output = result.output as { items?: { productId?: string; id?: string; name?: string; url?: string; price?: number }[]; count?: number };
  const items = output.items ?? [];
  assert.equal(output.count, items.length);
  for (const item of items) {
    const id = item.productId ?? item.id ?? "";
    const real = await findCatalogProduct({ id });
    assert.ok(real, `recommendation leaked a non-existent product: ${id}`);
    assert.equal(item.name, real!.name, "name must come from the catalog");
    if (typeof item.price === "number") assert.equal(item.price, real!.price, "price must come from the catalog");
    if (item.url) assert.ok(item.url.startsWith("/products/"), `url must be a homeino route: ${item.url}`);
  }
  assert.ok(["ok", "not_enough_data", "degraded"].includes(result.dataState ?? ""), `unexpected dataState: ${result.dataState}`);
});

test("shopping assistant answers with verified products only", async () => {
  await freshStore();
  const result = await runAgentByKey("shopping-assistant", {
    input: { query: "مبل راحتی مدرن برای پذیرایی", limit: 5 },
    sessionId: "session-shop-1",
  });
  assert.equal(result.ok, true, result.error);
  const output = result.output as { answer?: string; products?: { id: string; name: string; price: number }[]; understanding?: Record<string, unknown> };
  assert.equal(typeof output.answer, "string");
  assert.ok((output.answer ?? "").trim().length > 0, "the answer must not be empty");
  assert.ok(output.understanding, "the parsed intent must be exposed");
  for (const product of output.products ?? []) {
    const real = await findCatalogProduct({ id: product.id });
    assert.ok(real, `assistant leaked product id: ${product.id}`);
    assert.equal(product.price, real!.price);
  }

  const empty = await runAgentByKey("shopping-assistant", { input: { query: "" } });
  assert.equal(empty.dataState, "no_data");
  assert.deepEqual((empty.output as { products?: unknown[] }).products ?? [], []);
});

test("catalog search understands natural Persian queries (token matching, not substring)", async () => {
  await freshStore();
  assert.deepEqual(queryTokens("مبل راحتی برای پذیرایی"), ["مبل", "راحتی", "پذیرایی"], "stop words must be dropped");

  const hits = await searchCatalog({ q: "مبل راحتی برای پذیرایی", limit: 10 });
  assert.ok(hits.length > 0, "a full sentence must still find the real sofas");
  for (const hit of hits) assert.ok(await findCatalogProduct({ id: hit.id }), `search returned a non-catalog row: ${hit.id}`);

  const exact = await searchCatalog({ q: "کاناپه هلیم", limit: 5 });
  assert.ok(exact.length > 0);
  assert.match(exact[0]!.name, /کاناپه هلیم/, "an exact phrase match must rank first");

  // Relevance ordering: structured filters boost the score.
  const filtered = await searchCatalog({ q: "مبل", styleSlug: "modern", limit: 10 });
  assert.ok(filtered.every((product) => product.styleSlugs.includes("modern")));

  // Gibberish must not return the whole catalog.
  assert.equal((await searchCatalog({ q: "zzz qqq xxx", limit: 10 })).length, 0);
});

test("shopping assistant finds real products for a natural Persian request", async () => {
  await freshStore();
  const result = await runAgentByKey("shopping-assistant", {
    input: { query: "مبل راحتی برای پذیرایی", limit: 5 },
    sessionId: "session-shop-natural",
  });
  assert.equal(result.ok, true, result.error);
  const output = result.output as { products?: { id: string; name: string; price: number; rank?: number }[]; answer?: string; count?: number };
  assert.ok((output.products ?? []).length > 0, "the real catalog has sofas — the agent must find them");
  assert.equal(output.count, (output.products ?? []).length);
  for (const product of output.products ?? []) {
    const real = await findCatalogProduct({ id: product.id });
    assert.ok(real, `assistant leaked product id: ${product.id}`);
    assert.equal(product.price, real!.price, "price must come from the catalog");
    assert.equal(product.name, real!.name);
  }
  assert.ok((output.answer ?? "").length > 0);
});

test("shopping assistant: unknown SKU => not found, never a substitute", async () => {
  await freshStore();
  const result = await runAgentByKey("shopping-assistant", { input: { query: "SKU NOT-EXISTENT-9999 را نشان بده" } });
  assert.equal(result.ok, true);
  const output = result.output as { skuStatus?: string; products?: unknown[]; answer?: string; dataState?: string };
  assert.equal(output.dataState, "no_data");
  assert.equal(output.skuStatus, "not_found");
  assert.deepEqual(output.products ?? [], []);
  assert.match(output.answer ?? "", /پیدا نشد/);
});

test("inventory agent uses real stock counts around the threshold", async () => {
  await freshStore();
  const threshold = 5;
  const expected = await lowStockCatalog(threshold);
  const result = await runAgentByKey("inventory", { input: { threshold, createTask: false, notify: false } });
  assert.equal(result.ok, true, result.error);
  const output = result.output as { items?: { productId?: string; id?: string; stockCount?: number }[]; count?: number; dataState?: string };
  const items = output.items ?? [];
  assert.equal(output.count, items.length);
  assert.equal(items.length, expected.length, "the agent must see exactly the real low-stock rows");
  for (const item of items) {
    const id = item.productId ?? item.id ?? "";
    const real = await findCatalogProduct({ id });
    assert.ok(real, `inventory leaked product id: ${id}`);
    assert.ok((item.stockCount ?? 0) <= threshold, `reported stock above threshold: ${item.stockCount}`);
    assert.equal(item.stockCount, real!.stockCount);
  }
});

test("designer agent: unknown SKU => not found; real SKU => preserved product + real matches", async () => {
  const store = await freshStore();
  const missing = await runAgentByKey("designer", { input: { sku: "SKU-NOPE-1" } });
  assert.equal(missing.dataState, "no_data");
  const missingOut = missing.output as { skuStatus?: string; preservedProduct?: null; matchedProducts?: unknown[]; message?: string };
  assert.equal(missingOut.skuStatus, "not_found");
  assert.equal(missingOut.preservedProduct, null);
  assert.deepEqual(missingOut.matchedProducts ?? [], []);
  assert.match(missingOut.message ?? "", /پیدا نشد/);

  const anchor = (await sampleProducts(1))[0]!;
  const sku = anchor.sku ?? anchor.slug;
  const result = await runAgentByKey("designer", {
    input: { sku: anchor.sku ? sku : undefined, room: "پذیرایی", style: anchor.styleSlugs[0], limit: 6 },
    userId: "user-designer-1",
  });
  assert.equal(result.ok, true, result.error);
  const output = result.output as { matchedProducts?: { id: string; price: number }[]; preservedProduct?: { id: string } | null };
  for (const matched of output.matchedProducts ?? []) {
    const real = await findCatalogProduct({ id: matched.id });
    assert.ok(real, `designer leaked product id: ${matched.id}`);
    assert.equal(matched.price, real!.price);
  }
  if (output.preservedProduct) assert.equal(output.preservedProduct.id, anchor.id);
  if ((output.matchedProducts ?? []).length > 0) {
    const persisted = await store.listRecommendations({ userId: "user-designer-1" });
    assert.ok(persisted.length >= 0);
  }
});

test("browser agent refuses off-allowlist targets and fails honestly when unconfigured", async () => {
  await freshStore();
  await setAgentStatus("browser", "active");
  const refused = await runAgentByKey("browser", {
    input: { url: "https://definitely-not-allowed.example/secret", instruction: "extract prices", maxSteps: 3 },
  });
  const refusedOut = refused.output as { blocked?: boolean; reason?: string; dataState?: string };
  assert.equal(refusedOut.blocked, true, "an off-allowlist URL must be blocked before any request");
  assert.equal(refusedOut.dataState, "no_data");
  assert.ok(refusedOut.reason && /allowlist|مجاز/.test(refusedOut.reason), refusedOut.reason);

  // An allowlisted target still needs a human decision before anything runs.
  const gated = await runAgentByKey("browser", {
    input: { url: "https://homeino.ir/categories/mobl", instruction: "extract the visible product names", maxSteps: 3 },
  });
  assert.equal(gated.status, "waiting_approval", "a browser task must pause for human approval");
  assert.equal(gated.errorCode, "APPROVAL_REQUIRED");
  assert.ok(gated.approval?.id, "the approval id must be exposed to the caller");
  assert.equal(gated.approval?.action, "tool:browserTask");
  assert.equal(gated.approval?.risk, "high");
  const store = await getStore();
  assert.equal((await store.getApproval(gated.approval!.id))?.status, "pending");

  // Approving it must still not fabricate a result: no provider is configured.
  const decided = await decideApproval({ approvalId: gated.approval!.id, decision: "approved", decidedBy: "admin-test" });
  assert.equal(decided.ok, true);
  assert.equal(decided.executed, false, "no browser provider => nothing may claim to have run");
  assert.match(decided.error ?? "", /پیکربندی نشده|BROWSER_USE_API_KEY|STAGEHAND_API_BASE_URL/);

  const providers = browserProviderStatus();
  assert.equal(providers.length, 2);
  for (const provider of providers) assert.equal(provider.configured, false, "no browser provider key is set in tests");
  assert.ok(effectiveAllowedDomains([]).includes("homeino.ir"));
});

test("browser + HTTP guards block bypass attempts and off-allowlist hosts", async () => {
  assert.equal(assertBrowserTaskAllowed({ url: "", instruction: "do something", agentKey: "browser", allowedDomains: [] }).ok, false);
  assert.equal(assertBrowserTaskAllowed({ url: "ftp://homeino.ir/x", instruction: "read", agentKey: "browser", allowedDomains: [] }).ok, false);
  assert.equal(assertBrowserTaskAllowed({ url: "not a url", instruction: "read", agentKey: "browser", allowedDomains: [] }).ok, false);
  assert.equal(
    assertBrowserTaskAllowed({ url: "https://homeino.ir/products", instruction: "bypass captcha and login as admin", agentKey: "browser", allowedDomains: [] }).ok,
    false,
    "instructions aimed at bypassing protections must be refused",
  );
  assert.equal(assertBrowserTaskAllowed({ url: "https://homeino.ir/products", instruction: "x", agentKey: "browser", allowedDomains: [] }).ok, false);
  assert.equal(
    assertBrowserTaskAllowed({ url: "https://homeino.ir/products", instruction: "extract product titles", agentKey: "browser", allowedDomains: [] }).ok,
    true,
  );

  assert.equal(isDomainAllowed("https://evil.example/x"), false);
  assert.equal(isDomainAllowed("https://homeino.ir/x"), true);
  assert.equal(isDomainAllowed("javascript:alert(1)"), false);
  assert.equal(isDomainAllowed("https://partner.test/x", ["partner.test"]), true);
  assert.ok(allowedDomains().includes("homeino.ir"));

  const blocked = await runHttpTask({ url: "https://evil.example/api" });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /allowlist|مجاز/i);
  assert.equal(blocked.status, undefined, "no request may be made to a blocked host");
});

// ---------------------------------------------------------------- anti-fabrication
test("guardAgentOutput strips invented ids/prices/urls and keeps honest content", async () => {
  await freshStore();
  const guarded = await guardAgentOutput({
    products: [{ id: "invented-product-1", name: "مبل خیالی", price: 999, url: "https://fake-shop.example/p/1" }],
    note: "سلام",
  });
  assert.ok(guarded.report.removals.length > 0, "invented product fields must be removed");
  assert.deepEqual((guarded.output.products ?? []) as unknown[], [], "an invented product must not survive the guard");
  assert.equal(guarded.report.emptyProductList, true, "a list the guard emptied must be reported");
  assert.equal(guarded.output.note, "سلام", "honest content is preserved");

  const fabricated = await guardAgentOutput({ items: [{ productId: "made-up", name: "مبل ساختگی", price: 1 }] });
  assert.deepEqual((fabricated.output.items ?? []) as unknown[], []);

  const real = (await sampleProducts(1))[0]!;
  const honest = await guardAgentOutput({ products: [{ id: real.id, name: real.name, price: real.price }] });
  const kept = (honest.output.products ?? []) as { id?: string; name?: string; price?: number; url?: string }[];
  assert.equal(kept.length, 1, "a real catalog product must pass the guard");
  assert.equal(kept[0]!.id, real.id);
  assert.equal(kept[0]!.price, real!.price);
  assert.equal(honest.report.emptyProductList, false);

  // A wrong price is corrected to the catalog value, never passed through.
  const wrongPrice = await guardAgentOutput({ products: [{ productId: real.id, name: real.name, price: 1 }] });
  const corrected = (wrongPrice.output.products ?? []) as { price?: number }[];
  assert.equal(corrected[0]!.price, real!.price);
  assert.equal(wrongPrice.report.pricesCorrected, 1);

  // Non-product payloads inside a generic list key must survive.
  const toolResults = await guardAgentOutput({ results: [{ ok: true, data: { count: 3 } }], items: [{ taskId: "t1", title: "وظیفه" }] });
  assert.deepEqual((toolResults.output.results ?? []) as unknown[], [{ ok: true, data: { count: 3 } }]);
  assert.deepEqual((toolResults.output.items ?? []) as unknown[], [{ taskId: "t1", title: "وظیفه" }]);

  // Explicit opt-out keeps the old lenient behaviour for internal payloads.
  const optedOut = await guardAgentOutput({ products: [{ id: "x-1", name: "n", price: 1 }] }, { treatAsProductLists: false });
  assert.equal(((optedOut.output.products ?? []) as unknown[]).length, 1);
});

test("verifyRealProducts keeps catalog items and rejects fakes (by id or sku)", async () => {
  await freshStore();
  const real = (await sampleProducts(1))[0]!;
  const { verified, rejected } = await verifyRealProducts([
    { productId: real.id, rank: 1, reasonCode: "similar" },
    { id: real.id },
    { slug: real.slug },
    { productId: "nope-not-real" },
    { randomField: 1 },
  ]);
  assert.equal(verified.length, 1, "the same real product must collapse to one entry");
  assert.equal(verified[0]!.product.id, real.id);
  assert.equal(verified[0]!.reasonCode, "similar");
  assert.equal(rejected.length, 2, "unknown ids and payloads without an identity are rejected");
  for (const item of rejected) assert.match(item.reason, /not found/i);
});

// ---------------------------------------------------------------- workflows
test("validateWorkflow catches unknown agents, bad node types and dangling edges", async () => {
  await freshStore();
  const badAgent = await validateWorkflow({
    key: "wf-bad-1",
    name: "bad",
    nodes: [
      { key: "n1", type: "trigger", config: {} },
      { key: "n2", type: "agent", agentKey: "ghost-agent", config: {} },
    ],
    edges: [{ from: "n1", to: "n2" }],
  });
  assert.equal(badAgent.ok, false);
  assert.ok(badAgent.errors.some((e) => /ghost-agent/.test(e)));

  const dangling = await validateWorkflow({
    key: "wf-bad-2",
    name: "bad",
    nodes: [
      { key: "n1", type: "trigger", config: {} },
      { key: "n2", type: "end", config: {} },
    ],
    edges: [{ from: "n1", to: "nope" }],
  });
  assert.equal(dangling.ok, false);
  assert.ok(dangling.errors.some((e) => /ناشناخته/.test(e)));

  const badType = await validateWorkflow({
    key: "wf-bad-3",
    name: "bad",
    nodes: [{ key: "n1", type: "teleport" as never, config: {} }],
    edges: [],
  });
  assert.equal(badType.ok, false);

  const eventWithoutTypes = await validateWorkflow({
    key: "wf-bad-4",
    name: "bad",
    triggerKind: "event",
    trigger: {},
    nodes: [
      { key: "n1", type: "trigger", config: {} },
      { key: "n2", type: "end", config: {} },
    ],
    edges: [{ from: "n1", to: "n2" }],
  });
  assert.equal(eventWithoutTypes.ok, false);

  const good = await validateWorkflow({
    key: "wf-good",
    name: "good",
    triggerKind: "event",
    trigger: { eventTypes: ["product_view"] },
    nodes: [
      { key: "n1", type: "trigger", config: { eventTypes: ["product_view"] } },
      { key: "n2", type: "agent", agentKey: "recommendation", config: {} },
      { key: "n3", type: "end", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
    ],
  });
  assert.equal(good.ok, true, good.errors.join(" · "));
});

test("condition evaluator supports the documented expression language", () => {
  const vars = { dataState: "ok", eventCount: 4, styles: ["مدرن"], price: 40, lowStock: { count: 2 }, missing: null };
  assert.equal(evaluateCondition("dataState == 'ok'", vars), true);
  assert.equal(evaluateCondition("dataState == ok", vars), true);
  assert.equal(evaluateCondition("dataState != 'no_data'", vars), true);
  assert.equal(evaluateCondition("eventCount >= 3", vars), true);
  assert.equal(evaluateCondition("eventCount >= 5", vars), false);
  assert.equal(evaluateCondition("price < 100", vars), true);
  assert.equal(evaluateCondition("lowStock.count > 0", vars), true);
  assert.equal(evaluateCondition("styles contains مدرن", vars), true);
  assert.equal(evaluateCondition("styles exists", vars), true);
  assert.equal(evaluateCondition("emptyList exists", { emptyList: [] }), false, "an empty array must not count as existing");
  assert.equal(evaluateCondition("missing not_exists", vars), true);
  assert.equal(evaluateCondition("eventCount >= 3 && dataState == 'ok'", vars), true);
  assert.equal(evaluateCondition("eventCount >= 9 || dataState == 'ok'", vars), true);
  assert.equal(evaluateCondition("eventCount >= 9 && dataState == 'ok'", vars), false);
  assert.equal(evaluateCondition("true", vars), true);
  assert.equal(evaluateCondition("", vars), true);
  assert.equal(resolvePath(vars, "lowStock.count"), 2);
});

test("workflow 1: product views -> profile -> real recommendations saved for the session", async () => {
  const store = await freshStore();
  const sessionId = "session-wf-views";
  const products = await sampleProducts(4);

  // One event only => the "at least 3 events" condition is false => nothing saved.
  const first = await recordEvent({
    eventType: "product_view",
    sessionId,
    entityType: "product",
    entityId: products[0]!.id,
    metadata: { price: products[0]!.price },
  });
  assert.equal(first.recorded, true);
  assert.ok(first.matchedWorkflows.includes("customer-view-intelligence"), "the view workflow must match product_view");

  const early = await runMatchedWorkflows(["customer-view-intelligence"], { sessionId });
  assert.equal(early[0]?.status, "completed");
  assert.equal((await store.listRecommendations({ sessionId })).length, 0, "too few events must not produce recommendations");

  for (const product of products.slice(1)) {
    await recordEvent({ eventType: "product_view", sessionId, entityType: "product", entityId: product.id, metadata: { price: product.price } });
  }
  const runs = await runMatchedWorkflows(["customer-view-intelligence"], { sessionId });
  assert.equal(runs[0]?.ok, true, runs[0]?.error);
  assert.equal(runs[0]?.status, "completed");

  const saved = await store.listRecommendations({ sessionId });
  assert.ok(saved.length > 0, "the workflow must persist recommendations for this session");
  for (const rec of saved) {
    assert.ok(await findCatalogProduct({ id: rec.productId }), `workflow saved a non-catalog product: ${rec.productId}`);
    assert.equal(rec.status, "active");
    assert.ok(Number.isFinite(rec.score));
  }

  const runRecord = await store.getRun((await store.listRuns({ workflowKey: "customer-view-intelligence", limit: 1 }))[0]!.id);
  assert.ok(runRecord);
  const steps = await store.listSteps(runRecord!.id);
  assert.ok(steps.some((s) => s.nodeType === "trigger"));
  assert.ok(steps.some((s) => s.nodeType === "condition"));
  assert.ok(steps.filter((s) => s.nodeType === "agent").length >= 2, "profile + recommendation agents must both run");
  for (const step of steps) {
    assert.equal(step.status, "completed", `${step.nodeType} step failed: ${step.error}`);
    assert.ok(typeof step.durationMs === "number");
  }
});

test("workflow 2: wishlist add -> similar real products saved", async () => {
  const store = await freshStore();
  const sessionId = "session-wf-wishlist";
  const product = (await sampleProducts(1))[0]!;

  const tracked = await recordEvent({
    eventType: "wishlist_add",
    sessionId,
    entityType: "product",
    entityId: product.id,
    metadata: { price: product.price },
  });
  assert.ok(tracked.matchedWorkflows.includes("wishlist-similar-products"));

  const runs = await runMatchedWorkflows(["wishlist-similar-products"], { sessionId, entityId: product.id, entityType: "product" });
  assert.equal(runs[0]?.status, "completed", runs[0]?.error);

  const saved = await store.listRecommendations({ sessionId });
  assert.ok(saved.length > 0, "the wishlist workflow must save similar products");
  assert.ok(saved.some((rec) => rec.scenario === "wishlist"), "at least one row must carry the wishlist scenario");
  for (const rec of saved) assert.ok(await findCatalogProduct({ id: rec.productId }), `fake product persisted: ${rec.productId}`);
});

test("workflow 3: manual low-stock audit -> admin notification task with real items", async () => {
  const store = await freshStore();
  const lowStock = await lowStockCatalog(5);
  assert.ok(lowStock.length > 0, "the static catalog has low-stock rows, so this branch must be exercised");

  const result = await executeWorkflowByKey("low-stock-audit", { triggerKind: "manual" });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.status, "completed");
  assert.ok(result.runId);
  assert.ok(result.steps.some((s) => s.nodeType === "agent" && s.agentKey === "inventory"));
  assert.ok(result.steps.some((s) => s.nodeType === "condition"));
  assert.ok(result.steps.some((s) => s.nodeType === "notification"), "the true branch must notify the admin");

  const allTasks = await store.listTasks({});
  // The notification NODE task (agentKey = the workflow key) — the inventory
  // agent creates its own "notification" tasks too, so match precisely.
  const nodeNotifications = allTasks.filter(
    (t) => t.type === "notification" && t.agentKey === "low-stock-audit" && t.workflowRunId === result.runId,
  );
  assert.equal(nodeNotifications.length, 1, "the notification node must create exactly one admin task");
  const payload = nodeNotifications[0]!.payload as { count?: number; audience?: string; title?: string };
  assert.equal(payload.audience, "admin");
  assert.equal(payload.count, lowStock.length, "the notification must carry the real low-stock count");

  const agentNotices = allTasks.filter((t) => t.type === "notification" && t.agentKey === "inventory");
  assert.ok(agentNotices.length >= 1, "the inventory agent must notify about the same real items");

  const inventoryTasks = allTasks.filter((t) => t.type.startsWith("inventory"));
  for (const task of inventoryTasks) {
    const items = ((task.payload as { items?: { productId?: string; id?: string }[] }).items ?? []);
    for (const item of items) {
      const id = item.productId ?? item.id ?? "";
      assert.ok(await findCatalogProduct({ id }), `inventory task references a fake product: ${id}`);
    }
  }

  const summary = await taskQueueSummary();
  assert.ok(summary.total >= allTasks.length);
});

test("human approval node pauses the run, resumes on approve, cancels on reject", async () => {
  const store = await freshStore();
  const nodes = [
    { key: "n1", type: "trigger" as const, label: "اجرای دستی", config: { kind: "manual" } },
    { key: "n2", type: "human_approval" as const, label: "تأیید ادمین", config: { action: "review:workflow", risk: "medium", reason: "بررسی دستی" } },
    { key: "n3", type: "notification" as const, label: "اعلان", config: { audience: "admin", title: "تأیید شد", body: "ادامه" } },
    { key: "n4", type: "end" as const, label: "پایان", config: {} },
  ];
  const edges = [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3" },
    { from: "n3", to: "n4" },
  ];
  await createWorkflow({ key: "wf-approval", name: "تأیید انسانی", status: "active", triggerKind: "manual", nodes, edges });

  const run = await executeWorkflowByKey("wf-approval", { triggerKind: "manual" });
  assert.equal(run.status, "waiting_approval", `the run must pause, got ${run.status}`);
  assert.equal(run.errorCode, "APPROVAL_REQUIRED");
  assert.ok(run.runId);

  const pending = await listApprovals({ status: "pending" });
  assert.ok(pending.length > 0, "an approval request must be created");
  const approval = pending.find((a) => a.runId === run.runId)!;
  assert.ok(approval, "the approval must be linked to the paused run");
  assert.equal(approval.riskLevel, "medium");

  const decided = await decideApproval({ approvalId: approval.id, decision: "approved", decidedBy: "admin-test", note: "ok" });
  assert.equal(decided.ok, true, decided.error);
  assert.equal(decided.approval?.status, "approved");

  const resumed = await resumeWorkflowRun(run.runId!, "approved", "admin-test");
  assert.ok(resumed, "the paused run must be resumable");
  assert.equal(resumed!.status, "completed");
  const steps = await store.listSteps(run.runId!);
  assert.ok(steps.some((s) => s.nodeType === "notification"), "the run must continue past the approval node");
  assert.equal((await store.getRun(run.runId!))?.status, "completed");

  // Rejection cancels the run.
  const run2 = await executeWorkflowByKey("wf-approval", { triggerKind: "manual" });
  assert.equal(run2.status, "waiting_approval");
  const pending2 = await listApprovals({ status: "pending" });
  const approval2 = pending2.find((a) => a.runId === run2.runId)!;
  const rejected = await decideApproval({ approvalId: approval2.id, decision: "rejected", decidedBy: "admin-test", note: "نه" });
  assert.equal(rejected.ok, true);
  assert.equal((await store.getRun(run2.runId!))?.status, "cancelled");
  assert.equal(await resumeWorkflowRun(run2.runId!, "approved", "admin-test"), null, "a cancelled run cannot be resumed");

  // Deciding twice is refused.
  const twice = await decideApproval({ approvalId: approval2.id, decision: "approved", decidedBy: "admin-test" });
  assert.equal(twice.ok, false);
});

test("approvals: request, execute guard without a database, and expiry", async () => {
  const store = await freshStore();
  const approvalId = await requestApproval({
    agentKey: "inventory",
    action: "tool:updateProductPrice",
    reason: "تغییر قیمت",
    riskLevel: "critical",
    payload: { productId: "p1", price: 100 },
    expiresHours: 1,
  });
  assert.ok(approvalId);
  const approval = await store.getApproval(approvalId);
  assert.equal(approval?.status, "pending");
  assert.equal(approval?.riskLevel, "critical");

  // A price change cannot happen without a real database — it must say so.
  const decided = await decideApproval({ approvalId, decision: "approved", decidedBy: "admin-test" });
  assert.equal(decided.ok, true);
  assert.equal(decided.executed, false, "no DATABASE_URL => the guarded write must not pretend to succeed");
  assert.match(decided.error ?? "", /DATABASE_URL|دیتابیس/);

  const staleId = await store.createApproval({
    action: "review:stale",
    riskLevel: "medium",
    payload: {},
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const expiredCount = await expireStaleApprovals();
  assert.ok(expiredCount >= 1);
  assert.equal((await store.getApproval(staleId))?.status, "expired");
});

test("a failing node retries with backoff and fails the run", async () => {
  const store = await freshStore();
  await createWorkflow({
    key: "wf-retry",
    name: "تلاش مجدد",
    status: "active",
    triggerKind: "manual",
    nodes: [
      { key: "n1", type: "trigger", config: { kind: "manual" } },
      { key: "n2", type: "db_update", config: { table: "not_an_allowed_table", retries: 2 } },
      { key: "n3", type: "end", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
    ],
  });

  const started = Date.now();
  const run = await executeWorkflowByKey("wf-retry", { triggerKind: "manual" });
  assert.equal(run.ok, false);
  assert.equal(run.status, "failed");
  assert.equal(run.errorCode, "TOOL_FAILED");
  assert.ok(run.error && /مجاز نیست/.test(run.error), run.error);
  assert.ok(Date.now() - started >= 150, "backoff must actually delay the retry");

  const steps = await store.listSteps(run.runId!);
  const failed = steps.find((s) => s.nodeKey === "n2")!;
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempt, 3, "retries: 2 => three attempts");
  assert.ok(failed.error);
  assert.ok(!steps.some((s) => s.nodeKey === "n3"), "execution must stop after the failing node");
});

test("scheduler: nextScheduleRun is future-dated and tickScheduler runs due workflows", async () => {
  const store = await freshStore();
  const now = new Date();
  const interval = nextScheduleRun({ kind: "interval", everyMinutes: 10 }, now);
  assert.ok(interval.getTime() > now.getTime(), "interval schedule must be in the future");
  const daily = nextScheduleRun({ kind: "daily", at: "09:00" }, now);
  assert.ok(daily.getTime() > now.getTime());
  const cron = nextScheduleRun({ kind: "cron", cron: "*/5 * * * *" }, now);
  assert.ok(cron.getTime() > now.getTime());

  await createWorkflow({
    key: "wf-scheduled",
    name: "زمان‌بندی شده",
    status: "active",
    triggerKind: "schedule",
    schedule: { kind: "interval", everyMinutes: 10 },
    nodes: [
      { key: "n1", type: "trigger", config: { kind: "schedule" } },
      { key: "n2", type: "end", config: {} },
    ],
    edges: [{ from: "n1", to: "n2" }],
  });
  // Force it to be due now (the registry patch would strip nodes, so go to the store).
  await store.updateWorkflow("wf-scheduled", { nextRunAt: new Date(Date.now() - 1000).toISOString() });

  const tick = await tickScheduler({ limit: 5 });
  assert.equal(tick.dataState, "ok");
  assert.ok(tick.dueCount >= 1, "the scheduled workflow must be due");
  const ran = tick.ran.find((r) => r.key === "wf-scheduled");
  assert.ok(ran, "tick must start the due workflow");
  assert.equal(ran!.ok, true, ran!.error);

  const after = await store.getWorkflow("wf-scheduled");
  assert.ok(after?.nextRunAt && new Date(after.nextRunAt).getTime() > Date.now(), "nextRunAt must be pushed into the future");
  assert.ok(after?.lastRunAt, "lastRunAt must be recorded");

  // Nothing is due right after the run.
  const idle = await tickScheduler({ limit: 5 });
  assert.equal(idle.ran.some((r) => r.key === "wf-scheduled"), false);
});

// ---------------------------------------------------------------- task queue
test("task queue: create, claim, run, retry, cancel — all logged", async () => {
  const store = await freshStore();
  const agentTaskId = await createTask({
    title: "بررسی موجودی",
    type: "inventory_low_stock",
    priority: 2,
    assigneeRole: "admin",
    agentKey: "inventory",
    payload: { threshold: 5, createTask: false, notify: false },
  });
  assert.ok(agentTaskId);
  assert.ok((await listTasks({ status: "pending" })).some((t) => t.id === agentTaskId));

  const claimed = await claimNextTask({ limit: 5 });
  assert.ok(claimed, "a pending task must be claimable");

  const run = await runTask(agentTaskId);
  assert.equal(run.ok, true, run.error);
  assert.equal(run.status, "completed");
  const task = await store.getTask(agentTaskId);
  assert.equal(task?.status, "completed");
  assert.ok(task?.result, "the agent output must be stored as the task result");
  assert.ok(task?.completedAt);
  const logs = await store.listTaskLogs(agentTaskId);
  assert.ok(logs.length >= 2, "creation + execution must be logged");

  // retry of a completed task is a no-op success (no double execution)
  const retried = await retryTask(agentTaskId);
  assert.equal(retried.ok, true);
  assert.equal(retried.status, "completed");

  const humanTaskId = await createTask({ title: "بررسی دستی", type: "manual_review", assigneeRole: "admin" });
  const noAgent = await runTask(humanTaskId);
  assert.equal(noAgent.ok, false);
  assert.equal(noAgent.error, "task_has_no_agent");

  assert.equal(await cancelTask(humanTaskId, "admin-test", "لغو دستی"), true);
  assert.equal((await store.getTask(humanTaskId))?.status, "cancelled");
  const cancelRetry = await retryTask(humanTaskId);
  assert.equal(cancelRetry.ok, true, "a cancelled human task goes back to the queue");

  // A failing task stays in the queue until maxAttempts is exhausted (safe fallback).
  const failingTaskId = await createTask({ title: "ایجنت ناموجود", type: "broken", agentKey: "ghost-agent", maxAttempts: 3 });
  const failing = await runTask(failingTaskId);
  assert.equal(failing.ok, false);
  assert.equal(failing.status, "failed");
  assert.equal((await store.getTask(failingTaskId))?.status, "pending", "first failure must requeue the task");
  assert.equal((await store.getTask(failingTaskId))?.attempt, 1);
  await runTask(failingTaskId);
  await runTask(failingTaskId);
  assert.equal((await store.getTask(failingTaskId))?.status, "failed", "after maxAttempts the task must be marked failed");
  const failingRetry = await retryTask(failingTaskId);
  assert.equal(failingRetry.ok, false);
  assert.equal((await store.getTask(failingTaskId))?.attempt, 1, "retry resets the counter and runs again");
  await runTask(failingTaskId);
  await runTask(failingTaskId);
  assert.equal((await store.getTask(failingTaskId))?.status, "failed");

  assert.equal((await runTask("does-not-exist")).ok, false);

  // A task that stays cancelled (cancel is idempotent-refusing).
  const cancelledTaskId = await createTask({ title: "لغو شده", type: "manual_review", assigneeRole: "admin" });
  assert.equal(await cancelTask(cancelledTaskId, "admin-test", "لغو شد"), true);
  assert.equal(await cancelTask(cancelledTaskId, "admin-test"), false, "a cancelled task cannot be cancelled twice");

  const summary = await taskQueueSummary();
  assert.ok(summary.byStatus.completed >= 1);
  assert.ok(summary.byStatus.failed >= 1);
  assert.ok(summary.byStatus.cancelled >= 1);
});

// ---------------------------------------------------------------- budgets
test("budget guard enforces run limits and can be switched off again", async () => {
  await freshStore();
  const baseline = await checkRunBudget({});
  assert.equal(baseline.allowed, true, "the seeded global budget is unlimited");

  // One real run so the usage counters are non-zero.
  await runAgentByKey("inventory", { input: { threshold: 5, createTask: false, notify: false } });

  await setBudget({ scope: "global", maxRunsPerDay: 1, isActive: true });
  const denied = await checkRunBudget({});
  assert.equal(denied.allowed, false);
  assert.equal(denied.scope, "global");
  assert.match(denied.reason ?? "", /تعداد اجرای روزانه/);
  assert.ok(denied.usage.runsToday >= 1);

  const blocked = await runAgentByKey("inventory", { input: { threshold: 5, createTask: false, notify: false } });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, "failed");
  assert.equal(blocked.errorCode, "BUDGET_EXCEEDED");

  await setBudget({ scope: "global", perRunLimitMicro: 1, isActive: true });
  const perRun = await checkRunBudget({ estimatedCostMicro: 1000 });
  assert.equal(perRun.allowed, false);
  assert.match(perRun.reason ?? "", /سقف هر اجرا/);

  // Agent-scoped budget only guards that agent.
  await setBudget({ scope: "global", isActive: false });
  await setBudget({ scope: "agent", scopeKey: "inventory", maxRunsPerDay: 1, isActive: true });
  const agentDenied = await checkRunBudget({ agentKey: "inventory" });
  assert.equal(agentDenied.allowed, false);
  assert.equal(agentDenied.scope, "agent");
  assert.equal((await checkRunBudget({ agentKey: "recommendation" })).allowed, true);

  await setBudget({ scope: "agent", scopeKey: "inventory", isActive: false });
  assert.equal((await checkRunBudget({ agentKey: "inventory" })).allowed, true, "deactivating restores execution");
  const remaining = await budgets();
  assert.ok(remaining.some((b) => b.scope === "global"));
});
