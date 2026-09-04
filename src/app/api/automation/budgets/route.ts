// ============================================================
// /api/automation/budgets — cost control (admin)
//   GET → all budget rows + current usage per scope
//   PUT { scope, scopeKey?, dailyLimitMicro?, monthlyLimitMicro?,
//         perRunLimitMicro?, maxRunsPerDay?, isActive? }
//   0 means "not set" (unlimited) so a fresh install keeps working.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { budgets, getBudgetStatus, setBudget } from "@/services/automation/costControl";
import type { BudgetRecord } from "@/services/agents/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES: BudgetRecord["scope"][] = ["global", "agent", "workflow", "user"];

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const agentKey = url.searchParams.get("agentKey")?.slice(0, 80) ?? null;
  const workflowKey = url.searchParams.get("workflowKey")?.slice(0, 80) ?? null;
  const [rows, status] = await Promise.all([budgets(), getBudgetStatus({ agentKey, workflowKey })]);
  return ok({ items: rows, count: rows.length, status });
});

export const PUT = guard(async (req) => {
  await requireAdminUser(req);
  const body = (await readBody(req, 50_000)) as Record<string, unknown>;

  const scope = String(body.scope ?? "");
  if (!SCOPES.includes(scope as BudgetRecord["scope"])) throw ApiError.badRequest(`scope باید یکی از ${SCOPES.join(", ")} باشد`);
  const scopeKey = typeof body.scopeKey === "string" && body.scopeKey.trim() ? body.scopeKey.trim().slice(0, 80) : null;
  if (scope !== "global" && !scopeKey) throw ApiError.badRequest("برای scope غیر از global، مقدار scopeKey الزامی است");

  const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined);

  const saved = await setBudget({
    scope: scope as BudgetRecord["scope"],
    scopeKey,
    dailyLimitMicro: num(body.dailyLimitMicro),
    monthlyLimitMicro: num(body.monthlyLimitMicro),
    perRunLimitMicro: num(body.perRunLimitMicro),
    maxRunsPerDay: num(body.maxRunsPerDay),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  });
  if (!saved) throw ApiError.badRequest("ذخیره سقف هزینه ناموفق بود");
  return ok({ budget: saved, status: await getBudgetStatus({ agentKey: scope === "agent" ? scopeKey : null, workflowKey: scope === "workflow" ? scopeKey : null }) });
});
