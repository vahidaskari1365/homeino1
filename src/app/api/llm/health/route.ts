import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { llmStatus, type LlmProviderName, type LlmStatusEntry } from "@/services/agents/llmGateway";
import { resolveGeminiConfig } from "@/services/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LIVE provider health — the honest answer to «آداپتور هست ≠ پروایدر فعال است».
 * `llmStatus()` only proves config presence; this route pings each configured
 * endpoint with a cheap read call and reports real reachability + latency.
 * Admin-only (never leaks endpoint info publicly), 60s module cache.
 */

type LiveState = "up" | "down" | "skipped";

interface ProviderHealth {
  provider: LlmProviderName;
  configured: boolean;
  live: LiveState;
  latencyMs: number | null;
  error?: string;
}

interface CacheEntry {
  at: number;
  providers: ProviderHealth[];
  active: LlmProviderName | null;
}
const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

async function ping(url: string, headers: Record<string, string>, timeoutMs = 5_000): Promise<{ up: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    return { up: res.ok, latencyMs: Date.now() - started, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (error) {
    return { up: false, latencyMs: Date.now() - started, error: (error as Error).name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(provider: LlmProviderName, status: LlmStatusEntry): Promise<ProviderHealth> {
  if (!status.configured) return { provider, configured: false, live: "skipped", latencyMs: null };

  let probe_!: Promise<{ up: boolean; latencyMs: number; error?: string }>;
  switch (provider) {
    case "openai-compat":
      probe_ = ping(`${status.baseUrl}/models`, { Authorization: "Bearer •••".replace("•••", process.env.LLM_API_KEY ?? "") });
      break;
    case "ollama":
      probe_ = ping(`${status.baseUrl}/api/tags`, {});
      break;
    case "dify":
      probe_ = ping(`${status.baseUrl}/info`, { Authorization: `Bearer ${process.env.DIFY_API_KEY ?? ""}` });
      break;
    case "langflow":
      probe_ = ping(`${status.baseUrl}/api/v1/flows`, { "x-api-key": process.env.LANGFLOW_API_KEY ?? "" });
      break;
    case "gemini": {
      const cfg = await resolveGeminiConfig();
      if (!cfg.apiKey) return { provider, configured: false, live: "skipped", latencyMs: null };
      probe_ = ping(`https://generativelanguage.googleapis.com/v1beta/models?key=${cfg.apiKey}&pageSize=1`, {});
      break;
    }
    default:
      return { provider, configured: true, live: "skipped", latencyMs: null };
  }

  const result = await probe_;
  return { provider, configured: true, live: result.up ? "up" : "down", latencyMs: result.latencyMs, error: result.error };
}

export const GET = guard(async (req) => {
  await requireAdminUser(req);

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return ok({ ...cache, cached: true });
  }

  const statuses = llmStatus();
  const providers: ProviderHealth[] = [];
  for (const entry of statuses) {
    if (entry.provider === "heuristic") continue;
    providers.push(await probe(entry.provider, entry));
  }

  // First provider that is BOTH configured and actually reachable wins.
  const firstUp = providers.find((p) => p.configured && p.live === "up");

  const result: CacheEntry = {
    at: Date.now(),
    providers,
    active: firstUp?.provider ?? "heuristic",
  };
  cache = result;
  return ok({ ...result, cached: false });
});
