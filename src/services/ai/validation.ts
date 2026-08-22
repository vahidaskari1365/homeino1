// ============================================================
// HOMEINO AI — OUTPUT VALIDATION  (Phase 13)
//
// Every structured LLM output is validated against its contract.
// Invalid outputs get a BOUNDED retry (max 3 attempts, with a
// corrective hint fed back to the model). Infinite retry is
// forbidden — after the last attempt the failure is final and
// the caller degrades (heuristic fallback / honest error).
// ============================================================

/** Extract the first JSON object/array from a model answer. */
export function extractJsonPayload(raw: string): unknown {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch { /* fall through to regex */ }
  const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** Minimal structural validator for the intent contract. */
export interface IntentPayloadShape {
  intent?: unknown;
  target?: unknown;
  preservedElements?: unknown;
  changes?: unknown;
  style?: unknown;
  colors?: unknown;
  confidence?: unknown;
  scope?: unknown;
  protectedElements?: unknown;
  ambiguous?: unknown;
  note?: unknown;
}

const VALID_INTENTS = new Set([
  "targeted_edit", "full_redesign", "color_change", "add_item", "remove_item", "inquiry",
]);
const VALID_SCOPES = new Set(["single_item", "area", "room", "whole_home"]);

/**
 * Strict schema check — returns a list of human-readable problems
 * (empty array = valid). The caller decides retry vs. fallback.
 */
export function validateIntentPayload(raw: unknown): string[] {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return ["payload is not an object"];
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.intent !== "string" || !VALID_INTENTS.has(o.intent)) {
    problems.push(`intent must be one of ${[...VALID_INTENTS].join("|")}`);
  }
  if (!Array.isArray(o.target) || o.target.length === 0) {
    problems.push("target must be a non-empty array");
  } else if (!o.target.every((t) => typeof t === "string")) {
    problems.push("target entries must be strings");
  }
  if (o.preservedElements !== undefined && !Array.isArray(o.preservedElements)) {
    problems.push("preservedElements must be an array");
  }
  if (o.changes !== undefined && (!Array.isArray(o.changes) || o.changes.length > 3 || !o.changes.every((c) => typeof c === "string"))) {
    problems.push("changes must be a string array of max 3 items");
  }
  if (o.confidence !== undefined && (typeof o.confidence !== "number" || Number.isNaN(o.confidence) || o.confidence < 0 || o.confidence > 1)) {
    problems.push("confidence must be a number in 0..1");
  }
  if (o.scope !== undefined && (typeof o.scope !== "string" || !VALID_SCOPES.has(o.scope))) {
    problems.push(`scope must be one of ${[...VALID_SCOPES].join("|")}`);
  }
  if (o.colors !== undefined && !Array.isArray(o.colors)) {
    problems.push("colors must be an array");
  }
  return problems;
}

export interface RetryResult<T> {
  ok: boolean;
  value?: T;
  error?: unknown;
  attempts: number;
}

/**
 * Bounded retry with backoff.
 *
 * @param fn        attempt factory (attempt index 0-based)
 * @param attempts  max total attempts (default 3 — never infinite)
 * @param shouldRetry predicate deciding whether an error is retryable
 */
export async function withBoundedRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts?: { attempts?: number; shouldRetry?: (err: unknown, attempt: number) => boolean; delayMs?: (attempt: number) => number },
): Promise<RetryResult<T>> {
  const max = Math.max(1, Math.min(5, opts?.attempts ?? 3));
  const shouldRetry = opts?.shouldRetry ?? (() => true);
  const delay = opts?.delayMs ?? ((attempt: number) => 250 * (attempt + 1));

  let lastError: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      const value = await fn(attempt);
      return { ok: true, value, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      const retriable = shouldRetry(err, attempt);
      if (!retriable || attempt >= max - 1) break;
      await new Promise((r) => setTimeout(r, delay(attempt)));
    }
  }
  return { ok: false, error: lastError, attempts: max };
}
