// ============================================================
// /api/automation/content-runs — external content-agent activity (admin)
//
// The content agents (inspiration-curator, magazine-editor) run on
// GitHub Actions. Their execution records land in
// src/data/agent-runs.json (committed by the workflow itself).
// This route merges that history with the live registry definitions
// (schedule + config) so the admin panel shows REAL agent work.
// ============================================================
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { listAgents } from "@/services/agents/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_AGENT_KEYS = ["inspiration-curator", "magazine-editor"] as const;

interface FileRun {
  id: string;
  at: string;
  agentKey: string;
  ok: boolean;
  dry?: boolean;
  durationMs?: number;
  summary?: string;
  detail?: Record<string, unknown>;
}

async function readRunsFile(): Promise<{ updatedAt: string | null; runs: FileRun[] }> {
  // Per-agent run files — committed by the agents' workflows.
  // (One file per agent so overlapping runs never merge-conflict.)
  const dirs = [path.join(process.cwd(), "src/data/agent-runs"), path.join(process.cwd(), "../src/data/agent-runs")];
  const legacy = [path.join(process.cwd(), "src/data/agent-runs.json"), path.join(process.cwd(), "../src/data/agent-runs.json")];
  const runs: FileRun[] = [];
  for (const dir of dirs) {
    try {
      const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
      for (const name of names) {
        try {
          const parsed = JSON.parse(await readFile(path.join(dir, name), "utf8")) as { runs?: FileRun[] };
          if (Array.isArray(parsed.runs)) runs.push(...parsed.runs);
        } catch { /* skip malformed file */ }
      }
      if (runs.length) break;
    } catch { /* next candidate */ }
  }
  if (!runs.length) {
    // Legacy single-file fallback (older deploys)
    for (const file of legacy) {
      try {
        const parsed = JSON.parse(await readFile(file, "utf8")) as { updatedAt?: string; runs?: FileRun[] };
        if (Array.isArray(parsed.runs)) { runs.push(...parsed.runs); break; }
      } catch { /* next candidate */ }
    }
  }
  runs.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { updatedAt: runs[0]?.at ?? null, runs };
}

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14) || 14));
  const since = Date.now() - days * 86_400_000;

  const [file, allAgents] = await Promise.all([readRunsFile(), listAgents()]);
  const agents = allAgents
    .filter((a) => (CONTENT_AGENT_KEYS as readonly string[]).includes(a.key))
    .map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      status: a.status,
      schedule: a.schedule ?? null,
      config: a.config ?? {},
    }));

  const runs = file.runs.filter((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) ? t >= since : true;
  });

  const perAgent = Object.fromEntries(
    agents.map((a) => {
      const own = runs.filter((r) => r.agentKey === a.key);
      const items = own.reduce((sum, r) => sum + Number((r.detail as { added?: number } | undefined)?.added ?? 0), 0);
      return [a.key, {
        runs: own.length,
        ok: own.filter((r) => r.ok).length,
        failed: own.filter((r) => !r.ok).length,
        itemsAdded: items,
        lastRunAt: own[0]?.at ?? null,
        lastSummary: own[0]?.summary ?? null,
      }];
    }),
  );

  return ok({
    agents,
    runs,
    perAgent,
    updatedAt: file.updatedAt,
    dataState: runs.length ? "ok" : "no_data",
  });
});
