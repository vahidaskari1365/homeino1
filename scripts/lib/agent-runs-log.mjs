// ============================================================
// HOMEINO — agent execution log (content agents, file-based).
//
// The content agents run on GitHub Actions — outside the app's
// runtime and its agent store. So their runs are appended to
// src/data/agent-runs.json (committed by the same workflow) and
// surfaced in /admin/automation via /api/automation/content-runs.
//
// Usage (in a daily script):
//   await logContentAgentRun(ROOT, {
//     agentKey: "inspiration-curator",
//     ok: true,
//     durationMs: 52_000,
//     summary: "۶ پین جدید افزوده شد",
//     detail: { added: 6, via: "llm" },
//   });
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FILE = (ROOT) => join(ROOT, "src/data/agent-runs.json");
const MAX_RUNS = 200;

/**
 * Append one run record (newest first) and cap the history.
 * Never throws — a logging failure must not fail the agent run.
 */
export async function logContentAgentRun(ROOT, entry) {
  try {
    const file = FILE(ROOT);
    const current = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { updatedAt: null, runs: [] };
    const runs = Array.isArray(current.runs) ? current.runs : [];
    runs.unshift({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...entry,
    });
    const capped = runs.slice(0, MAX_RUNS);
    writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), runs: capped }, null, 2) + "\n");
  } catch (err) {
    console.warn("[agent-runs] log write skipped:", err?.message ?? err);
  }
}

/** Read the run history (server-side helper for the API route). */
export function readContentAgentRuns(ROOT) {
  const file = FILE(ROOT);
  if (!existsSync(file)) return { updatedAt: null, runs: [] };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return { updatedAt: parsed.updatedAt ?? null, runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
  } catch {
    return { updatedAt: null, runs: [] };
  }
}
