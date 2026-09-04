// ============================================================
// /api/automation/memory — customer memory + profile inspection (admin)
//
//   GET  ?userId=&kind=&limit=  → stored memories + computed profile
//   POST { userId, recompute? } → re-run the Customer Intelligence agent
//
// Memory is read from the database (Supabase) — never from a browser's
// localStorage. When there is no evidence the response says so.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { customerMemory } from "@/services/memory/customerMemory";
import { computeCustomerProfile, effectiveProfile } from "@/services/memory/preferenceEngine";
import { runAgentByKey } from "@/services/agents/runtime";
import type { MemoryKind } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: MemoryKind[] = ["preference", "interaction", "design", "request", "recommendation", "dismissal", "purchase", "note"];
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (!UUID_RE.test(userId)) throw ApiError.badRequest("userId نامعتبر است");
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam && KINDS.includes(kindParam as MemoryKind) ? (kindParam as MemoryKind) : undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const [memories, profile] = await Promise.all([customerMemory.all(userId, { kind, limit }), effectiveProfile({ userId })]);
  return ok({
    userId,
    memories,
    count: memories.length,
    profile,
    dataState: memories.length || profile?.dataState === "ok" ? "ok" : "no_data",
    backend: customerMemory.status(),
  });
});

export const POST = guard(async (req) => {
  await requireAdminUser(req);
  const body = (await readBody(req, 50_000)) as Record<string, unknown>;
  const userId = String(body.userId ?? "");
  if (!UUID_RE.test(userId)) throw ApiError.badRequest("userId نامعتبر است");

  if (body.recompute === true) {
    const profile = await computeCustomerProfile({ userId, persist: true, agentKey: "customer-intelligence" });
    return ok({ userId, profile, dataState: profile.dataState, source: "recomputed" });
  }

  const run = await runAgentByKey("customer-intelligence", {
    input: { userId, persist: true },
    userId,
    triggeredBy: "admin:memory",
  });
  return ok({ userId, run: { ok: run.ok, status: run.status, output: run.output, error: run.error ?? null }, dataState: run.dataState ?? "no_data" });
});
