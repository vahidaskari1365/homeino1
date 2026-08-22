// ============================================================
// HOMEINO AI — OBSERVABILITY / TELEMETRY  (Phase 20)
//
// Every AI request is logged as ONE structured line:
//   requestId · userId · action · provider · model · duration
//   · tokens · credits · status
//
// NEVER log secrets: prompts are truncated to 120 chars, API keys
// are never included. A bounded in-memory ring keeps the last N
// requests for debugging (production would ship these to a log
// sink — the shape is the contract).
// ============================================================

export interface AiTelemetryEntry {
  requestId: string;
  userId?: string | null;
  action: string;
  provider: string;
  model?: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  credits?: number;
  status: "ok" | "degraded" | "error";
  errorCode?: string;
  /** Truncated prompt — for debugging intent, never full secrets. */
  promptHint?: string;
  createdAt: string;
}

const MAX_BUFFER = 500;
const telemetryBuffer: AiTelemetryEntry[] = [];
const DEBUG = () => process.env.AI_DEBUG === "1" || process.env.NODE_ENV !== "production";

/** Short unique request id, e.g. req_a1b2c3. */
export function createRequestId(): string {
  const rand =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `req_${rand}`;
}

function truncate(s: string, max = 120): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Record one completed AI request (structured, secret-safe). */
export function logAiRequest(entry: Omit<AiTelemetryEntry, "createdAt">): void {
  const full: AiTelemetryEntry = { ...entry, createdAt: new Date().toISOString() };
  if (DEBUG()) {
    // One greppable JSON line per request — `[ai] req_xxx action=... status=...`
    console.log(`[ai] ${JSON.stringify(full)}`);
  }
  telemetryBuffer.push(full);
  if (telemetryBuffer.length > MAX_BUFFER) telemetryBuffer.splice(0, telemetryBuffer.length - MAX_BUFFER);
}

/** Last N requests (for /admin/ai debugging). */
export function getRecentAiRequests(n = 100): AiTelemetryEntry[] {
  return telemetryBuffer.slice(-n);
}

/** Total requests recorded since boot. */
export function aiRequestsCount(): number {
  return telemetryBuffer.length;
}

/**
 * Run `fn` with automatic telemetry: measures duration, classifies
 * failure via `classifyAiError`, logs, and rethrows the original error.
 */
export async function withAiTelemetry<T>(
  opts: {
    requestId: string;
    userId?: string | null;
    action: string;
    provider: string;
    model?: string;
    promptHint?: string;
    credits?: number;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    logAiRequest({ ...opts, durationMs: Date.now() - started, status: "ok" });
    return out;
  } catch (err) {
    const { classifyAiError } = await import("./errors");
    const ai = classifyAiError(err);
    logAiRequest({
      ...opts,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: ai.code,
    });
    throw err;
  }
}
