// ============================================================
// Smoke-run a FREE AGENT BLUEPRINT through the real runtime.
// Usage: npm run agents:smoke -- key="support-agent" task="..."
// Proves: store → registry → declarative handler → defaultToolPlan
// (no LLM configured → deterministic tool mode, honest dataState).
// ============================================================
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const arg = (name: string): string | undefined => {
    const hit = process.argv.find((a) => a.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  };
  const key = arg("key") ?? "support-agent";
  const task = arg("task") ?? "وضعیت سفارش‌های من چطوره؟";

  const { runAgentByKey } = await import("../src/services/agents/runtime");
  const run = await runAgentByKey(key, {
    input: { task },
    userId: null,
    sessionId: "smoke-blueprint",
    triggeredBy: "script:smoke-blueprint",
  });

  console.log(`[smoke] agent=${key} ok=${run.ok} status=${run.status} dataState=${run.dataState}`);
  console.log(`[smoke] mode=${String((run.output as Record<string, unknown>)?.mode ?? "-")} toolsUsed=${JSON.stringify((run.output as Record<string, unknown>)?.toolsUsed ?? (run.output as Record<string, unknown>)?.results ? Object.keys((run.output as Record<string, unknown>)?.results ?? {}) : [])}`);
  console.log(`[smoke] output=${JSON.stringify(run.output).slice(0, 600)}`);
  if (!run.ok) process.exit(1);
}

main().catch((err) => {
  console.error("[smoke] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
