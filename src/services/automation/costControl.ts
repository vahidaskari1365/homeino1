// ============================================================
// HOMEINO — COST CONTROL
//
// Agents cannot burn tokens without limits. Budgets are stored per scope
// (global / agent / workflow / user) and checked BEFORE a run starts; actual
// usage is recorded with every execution log row.
//
// A limit of 0 means "not set" (unlimited) so a fresh install keeps working.
// ============================================================
import { getStore } from "../agents/store";
import type { BudgetRecord } from "../agents/store/types";

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  scope?: BudgetRecord["scope"];
  limits: { dailyLimitMicro: number; monthlyLimitMicro: number; perRunLimitMicro: number; maxRunsPerDay: number };
  usage: { todayMicro: number; monthMicro: number; runsToday: number };
}

const UNLIMITED = { dailyLimitMicro: 0, monthlyLimitMicro: 0, perRunLimitMicro: 0, maxRunsPerDay: 0 };

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function budgets(): Promise<BudgetRecord[]> {
  const store = await getStore();
  return store.listBudgets();
}

function findBudget(list: BudgetRecord[], scope: BudgetRecord["scope"], key?: string | null): BudgetRecord | undefined {
  return list.find((b) => b.isActive && b.scope === scope && (b.scopeKey ?? null) === (key ?? null));
}

export async function checkRunBudget(options: {
  agentKey?: string | null;
  workflowKey?: string | null;
  userId?: string | null;
  estimatedCostMicro?: number;
}): Promise<BudgetCheck> {
  const store = await getStore();
  const list = await store.listBudgets();
  const estimated = options.estimatedCostMicro ?? 0;

  const scopes: [BudgetRecord["scope"], string | null | undefined][] = [
    ["global", null],
    ["agent", options.agentKey],
    ["workflow", options.workflowKey],
    ["user", options.userId],
  ];

  for (const [scope, key] of scopes) {
    if (scope !== "global" && !key) continue;
    const budget = findBudget(list, scope, key ?? null);
    if (!budget) continue;

    const [today, month] = await Promise.all([
      store.usageSince({ kind: scope === "global" ? "global" : scope, key: key ?? null, since: startOfToday() }),
      store.usageSince({ kind: scope === "global" ? "global" : scope, key: key ?? null, since: startOfMonth() }),
    ]);

    const usage = { todayMicro: today.costMicro, monthMicro: month.costMicro, runsToday: today.runs };
    const limits = {
      dailyLimitMicro: budget.dailyLimitMicro,
      monthlyLimitMicro: budget.monthlyLimitMicro,
      perRunLimitMicro: budget.perRunLimitMicro,
      maxRunsPerDay: budget.maxRunsPerDay,
    };

    if (limits.perRunLimitMicro > 0 && estimated > limits.perRunLimitMicro) {
      return { allowed: false, reason: `برآورد هزینه این اجرا (${estimated}) از سقف هر اجرا (${limits.perRunLimitMicro}) بیشتر است`, scope, limits, usage };
    }
    if (limits.dailyLimitMicro > 0 && usage.todayMicro + estimated > limits.dailyLimitMicro) {
      return { allowed: false, reason: "سقف هزینه روزانه پر شده است", scope, limits, usage };
    }
    if (limits.monthlyLimitMicro > 0 && usage.monthMicro + estimated > limits.monthlyLimitMicro) {
      return { allowed: false, reason: "سقف هزینه ماهانه پر شده است", scope, limits, usage };
    }
    if (limits.maxRunsPerDay > 0 && usage.runsToday >= limits.maxRunsPerDay) {
      return { allowed: false, reason: "سقف تعداد اجرای روزانه پر شده است", scope, limits, usage };
    }
  }

  return { allowed: true, limits: UNLIMITED, usage: { todayMicro: 0, monthMicro: 0, runsToday: 0 } };
}

/** Micro-cost → human readable (Toman-ish display for the admin panel). */
export function formatMicro(costMicro: number): string {
  if (!costMicro) return "۰";
  const toman = costMicro / 1_000_000;
  return toman >= 1 ? `${toman.toFixed(2)} واحد` : `${costMicro} میکرو`;
}

/** Per-scope usage snapshot for the admin cost panel. */
export async function getBudgetStatus(options: { agentKey?: string | null; workflowKey?: string | null; userId?: string | null } = {}) {
  const list = await budgets();
  const rows = [];
  for (const scope of ["global", "agent", "workflow", "user"] as const) {
    const key = scope === "agent" ? options.agentKey : scope === "workflow" ? options.workflowKey : scope === "user" ? options.userId : null;
    if (scope !== "global" && !key) continue;
    const budget = findBudget(list, scope, key ?? null);
    if (!budget) continue;
    const check = await checkRunBudget({ agentKey: options.agentKey, workflowKey: options.workflowKey, userId: options.userId });
    rows.push({ scope, scopeKey: budget.scopeKey ?? null, isActive: budget.isActive, limits: {
      dailyLimitMicro: budget.dailyLimitMicro,
      monthlyLimitMicro: budget.monthlyLimitMicro,
      perRunLimitMicro: budget.perRunLimitMicro,
      maxRunsPerDay: budget.maxRunsPerDay,
    }, usage: check.usage, allowed: check.allowed });
  }
  if (!rows.length) {
    const check = await checkRunBudget(options);
    return { rows: [], usage: check.usage, allowed: check.allowed, dataState: "no_data" as const };
  }
  return { rows, usage: rows[0]?.usage ?? { todayMicro: 0, monthMicro: 0, runsToday: 0 }, allowed: rows.every((r) => r.allowed), dataState: "ok" as const };
}

/** Create or update a budget (admin only — the API route enforces RBAC). */
export async function setBudget(input: {
  scope: BudgetRecord["scope"];
  scopeKey?: string | null;
  dailyLimitMicro?: number;
  monthlyLimitMicro?: number;
  perRunLimitMicro?: number;
  maxRunsPerDay?: number;
  isActive?: boolean;
}): Promise<BudgetRecord | null> {
  const store = await getStore();
  return store.upsertBudget({
    scope: input.scope,
    scopeKey: input.scope === "global" ? null : input.scopeKey ?? null,
    dailyLimitMicro: Math.max(0, Math.round(input.dailyLimitMicro ?? 0)),
    monthlyLimitMicro: Math.max(0, Math.round(input.monthlyLimitMicro ?? 0)),
    perRunLimitMicro: Math.max(0, Math.round(input.perRunLimitMicro ?? 0)),
    maxRunsPerDay: Math.max(0, Math.round(input.maxRunsPerDay ?? 0)),
    isActive: input.isActive !== false,
  });
}
