import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { getCampaignPublic, getLiveStats } from "@/services/marketing";

export const runtime = "nodejs";

type StatsPayload = Awaited<ReturnType<typeof buildStats>>;

declare global {
  var __homeinoStatsCache: { at: number; value: StatsPayload } | undefined;
}

async function buildStats() {
  const [stats, campaign] = await Promise.all([getLiveStats(), getCampaignPublic()]);
  return { ...stats, campaign };
}

/**
 * Public marketing payload: REAL design counters + recent (anonymized)
 * activity + the active campaign. Cached in-memory for 20s so landing
 * traffic never hammers the DB. Empty/zero data → client hides the UI.
 */
export const GET = guard(async () => {
  const now = Date.now();
  if (!globalThis.__homeinoStatsCache || now - globalThis.__homeinoStatsCache.at > 20_000) {
    globalThis.__homeinoStatsCache = { at: now, value: await buildStats() };
  }
  return ok(globalThis.__homeinoStatsCache.value);
});
