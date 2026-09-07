// ============================================================
// HOMEINO — verify the three seeded agentic workflows really run
// end-to-end through the real engine (Stage 9 of the agentic
// marketplace prompt):
//
//   A  customer-view-intelligence   view → profile → recommendation → save
//   B  wishlist-similar-products    wishlist → analyze → similar → save
//   C  low-stock-audit              manual run → low stock → task → log
//
// Runs in-process (memory store, honest no-LLM mode):
//   npx esbuild scripts/verify-workflows.ts --bundle --platform=node \
//     --format=esm --alias:@=./src --external:pg --external:dotenv \
//     --outfile=.verify-workflows.mjs && node .verify-workflows.mjs
// ============================================================
import dotenv from "dotenv";
dotenv.config();

interface StepTrace {
  key: string;
  status: string;
  label?: string;
}

async function main() {
  const { executeWorkflowByKey } = await import("../src/services/workflows/engine");
  const { ensureSeeded, storeMode } = await import("../src/services/agents/store");

  const store = await ensureSeeded();
  console.log("[workflows] store mode:", store.mode);

  const results: { key: string; ok: boolean; status: string; steps: number; note: string }[] = [];

  // ---------- Workflow A: customer view → intelligence → recommendation ----------
  try {
    const a = await executeWorkflowByKey("customer-view-intelligence", {
      triggerKind: "manual",
      triggerPayload: { via: "verify-workflows" },
      input: { userId: "verify-user-a", eventTypes: ["product_view", "product_search"] },
      userId: "verify-user-a",
      sessionId: "verify-workflows",
      actorRole: "system",
    });
    results.push({
      key: "A customer-view-intelligence",
      ok: a.ok,
      status: a.status,
      steps: (a.steps as StepTrace[])?.length ?? 0,
      note: a.ok ? "run completed" : a.error ?? "failed",
    });
  } catch (error) {
    results.push({ key: "A customer-view-intelligence", ok: false, status: "threw", steps: 0, note: String(error) });
  }

  // ---------- Workflow B: wishlist → analyze → similar products ----------
  try {
    const b = await executeWorkflowByKey("wishlist-similar-products", {
      triggerKind: "manual",
      triggerPayload: { via: "verify-workflows" },
      input: { userId: "verify-user-b", entityId: "sofa-royal-cream" },
      userId: "verify-user-b",
      sessionId: "verify-workflows",
      actorRole: "system",
    });
    results.push({
      key: "B wishlist-similar-products",
      ok: b.ok,
      status: b.status,
      steps: (b.steps as StepTrace[])?.length ?? 0,
      note: b.ok ? "run completed" : b.error ?? "failed",
    });
  } catch (error) {
    results.push({ key: "B wishlist-similar-products", ok: false, status: "threw", steps: 0, note: String(error) });
  }

  // ---------- Workflow C: manual run → inventory agent → task ----------
  try {
    const c = await executeWorkflowByKey("low-stock-audit", {
      triggerKind: "manual",
      triggerPayload: { via: "verify-workflows" },
      input: {},
      userId: null,
      sessionId: "verify-workflows",
      actorRole: "admin",
    });
    results.push({
      key: "C low-stock-audit",
      ok: c.ok,
      status: c.status,
      steps: (c.steps as StepTrace[])?.length ?? 0,
      note: c.ok ? "run completed" : c.error ?? "failed",
    });
  } catch (error) {
    results.push({ key: "C low-stock-audit", ok: false, status: "threw", steps: 0, note: String(error) });
  }

  console.log("\n[workflows] results:");
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.key} — status=${r.status} steps=${r.steps} ${r.note}`);
  }

  // Tasks created by workflow C should be visible in the store.
  const tasks = await store.listTasks?.({ limit: 10 });
  if (tasks?.length) {
    console.log(`\n[tasks] ${tasks.length} task(s) in queue, latest: ${tasks[0]?.title ?? "—"}`);
  }

  // ---------- New prompt agents through the real runtime ----------
  const { runAgentByKey } = await import("../src/services/agents/runtime");
  const agentRuns: { key: string; ok: boolean; dataState: string; note: string }[] = [];
  for (const [key, input] of [
    ["vendor-agent", { vendorSlug: "noor-mobl" }],
    ["marketing-agent", {}],
    ["development-agent", { task: "افزودن تست برای سرویس پرداخت" }],
  ] as const) {
    try {
      // development-agent ships as draft on purpose — activating it here mirrors
      // the admin panel's «فعال‌سازی» action (Stage 5 lifecycle: activate → run).
      const existing = await store.getAgent(key);
      if (existing && existing.status === "draft") await store.updateAgent(key, { status: "active" });
      const run = await runAgentByKey(key, {
        input: { ...input },
        userId: "verify-user-a",
        sessionId: "verify-workflows",
        triggeredBy: "script:verify-workflows",
      });
      const output = (run.output ?? {}) as { dataState?: string; summary?: string };
      // The development agent ends in waiting_approval BY DESIGN — its plan
      // must be human-approved (Stage 4.8). Both terminal states are success.
      const okStatus = run.status === "completed" || run.status === "waiting_approval";
      agentRuns.push({
        key,
        ok: okStatus,
        dataState: String(output.dataState ?? "—"),
        note: `${run.status === "waiting_approval" ? "[در انتظار تأیید انسانی — درست] " : ""}${String(output.summary ?? run.error ?? "")}`.slice(0, 100),
      });
    } catch (error) {
      agentRuns.push({ key, ok: false, dataState: "threw", note: String(error).slice(0, 90) });
    }
  }

  console.log("\n[agents] prompt-required agents through the real runtime:");
  for (const r of agentRuns) {
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.key} — dataState=${r.dataState} ${r.note}`);
  }

  if (failed) {
    console.error(`\n✗ ${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ ALL THREE SEEDED WORKFLOWS RUN END-TO-END");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
