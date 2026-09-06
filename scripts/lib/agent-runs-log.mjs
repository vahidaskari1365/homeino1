// ============================================================
// HOMEINO — agent execution log (content agents, file-based).
//
// The content agents run on GitHub Actions — outside the app's
// runtime and its agent store. Their runs are appended to a
// PER-AGENT file: src/data/agent-runs/<agentKey>.json (committed
// by the same workflow) and surfaced in /admin/automation via
// /api/automation/content-runs plus the public trust strip.
//
// Why per-agent files: two agents can commit around the same
// time; a single shared JSON made every overlapping push a
// rebase conflict. Distinct files never conflict.
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
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = (ROOT) => join(ROOT, "src", "data", "agent-runs");
const LEGACY_FILE = (ROOT) => join(ROOT, "src", "data", "agent-runs.json");
const MAX_RUNS = 200;

/**
 * Append one run record (newest first) to the agent's own file.
 * Never throws — a logging failure must not fail the agent run.
 */
export async function logContentAgentRun(ROOT, entry) {
  try {
    const key = String(entry?.agentKey ?? "").trim();
    if (!key || /[\\/.]/.test(key)) throw new Error(`bad agentKey: ${key}`);
    const file = join(DIR(ROOT), `${key}.json`);
    const current = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { agentKey: key, updatedAt: null, runs: [] };
    const runs = Array.isArray(current.runs) ? current.runs : [];
    runs.unshift({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...entry,
    });
    const capped = runs.slice(0, MAX_RUNS);
    writeFileSync(
      file,
      JSON.stringify({ agentKey: key, updatedAt: new Date().toISOString(), runs: capped }, null, 2) + "\n",
    );
  } catch (err) {
    console.warn("[agent-runs] log write skipped:", err?.message ?? err);
  }
}

/**
 * Read the merged run history across all per-agent files
 * (server-side helper; keeps legacy single-file fallback).
 */
export function readContentAgentRuns(ROOT) {
  const runs = [];
  try {
    const dir = DIR(ROOT);
    if (existsSync(dir)) {
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
        try {
          const parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
          if (Array.isArray(parsed.runs)) runs.push(...parsed.runs);
        } catch { /* skip malformed file */ }
      }
    }
    const legacy = LEGACY_FILE(ROOT);
    if (existsSync(legacy)) {
      const parsed = JSON.parse(readFileSync(legacy, "utf8"));
      if (Array.isArray(parsed.runs)) runs.push(...parsed.runs);
    }
  } catch { /* fall through */ }
  runs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { updatedAt: runs[0]?.at ?? null, runs };
}
