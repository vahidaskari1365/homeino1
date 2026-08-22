// ============================================================
// HOMEINO AI — SERVER-SIDE CREDIT GATE  (Phase 17)
//
// Credit consumption must NOT depend only on UI clicks — the
// server must be able to control it. This module implements the
// authoritative flow:
//
//   check credits → reserve/deduct → run AI → success → finalize
//                                          → failure → refund
//
// It is OPT-IN via `AI_SERVER_CREDITS=1` so existing deployments
// (which charge optimistically on the client) are NOT double-
// charged until they flip the flag. When enabled AND a database
// is configured, the gate is authoritative:
//   • INSUFFICIENT_CREDITS → generation aborts before any AI work.
//   • success → finalize (generation row marked succeeded).
//   • failure → refund via idempotency key (never double-refund).
// When the DB is not available the gate reports "not available"
// and the pipeline continues with client-side crediting.
// ============================================================

import { AiError } from "./errors";

export const serverCreditsEnabled = (): boolean => process.env.AI_SERVER_CREDITS === "1";

export interface ReserveResult {
  /** True when the server charged credits for this generation. */
  charged: boolean;
  /** Row id of the created generation (only when charged). */
  generationId?: string;
  cost: number;
}

/**
 * Reserve + deduct credits BEFORE running the AI. Throws
 * AiError(INSUFFICIENT_CREDITS) when the balance cannot cover the
 * cost — the caller must abort the generation in that case.
 */
export async function reserveCreditsForAi(opts: {
  userId: string;
  mode: string;
  prompt: string;
  productId?: string;
  cost: number;
}): Promise<ReserveResult> {
  if (!serverCreditsEnabled() || !process.env.DATABASE_URL) {
    return { charged: false, cost: opts.cost };
  }
  try {
    const { startGeneration } = await import("@/services/aiService");
    const generation = await startGeneration(opts.userId, {
      productId: opts.productId,
      prompt: opts.prompt.slice(0, 500),
      mode: opts.mode,
    });
    return { charged: true, generationId: generation.id, cost: generation.creditCost ?? opts.cost };
  } catch (err) {
    const status = (err as { status?: unknown })?.status;
    if (status === 422 || /اعتبار کافی نیست|INSUFFICIENT_CREDITS/.test(err instanceof Error ? err.message : String(err))) {
      throw AiError.insufficientCredits();
    }
    // DB not reachable / other infra problem → do not block the user;
    // log and continue with the client-side credit flow.
    console.warn("[ai-credits] server credit gate unavailable:", err instanceof Error ? err.message : err);
    return { charged: false, cost: opts.cost };
  }
}

/** Mark a charged generation as succeeded. */
export async function finalizeCreditsForAi(generationId: string, data: { durationMs?: number; outputAssetUrl?: string }) {
  if (!serverCreditsEnabled()) return;
  try {
    const { completeGeneration } = await import("@/services/aiService");
    await completeGeneration(generationId, {
      outputAssetUrl: data.outputAssetUrl,
      durationMs: data.durationMs,
    });
  } catch (err) {
    console.warn("[ai-credits] finalize failed:", err instanceof Error ? err.message : err);
  }
}

/** Refund a charged generation that failed (idempotent by design). */
export async function refundCreditsForAi(generationId: string, error: string) {
  if (!serverCreditsEnabled()) return;
  try {
    const { failGeneration } = await import("@/services/aiService");
    await failGeneration(generationId, error.slice(0, 500));
  } catch (err) {
    console.warn("[ai-credits] refund failed:", err instanceof Error ? err.message : err);
  }
}
