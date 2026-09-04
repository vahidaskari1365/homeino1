// ============================================================
// HOMEINO — AGENT STORE RESOLVER
//
//   DATABASE_URL set + agentic tables reachable → database adapter (Supabase)
//   otherwise                                   → in-process adapter
//
// The probe is cached: a missing migration must never take the storefront down,
// it only downgrades the orchestrator to in-process mode (and says so in the
// admin panel through `storeMode()`).
// ============================================================
import { databaseAgentStore, databaseStoreSeeds } from "./database";
import { memoryAgentStore, memoryStoreSeeds, resetMemoryStore } from "./memory";
import { BUILTIN_AGENTS, BUILTIN_TOOLS, BUILTIN_WORKFLOWS, DEFAULT_BUDGETS, DEFAULT_INTEGRATIONS } from "../defaults";
import type { AgentStore } from "./types";

export type StoreMode = "database" | "memory";

const globalForResolver = globalThis as typeof globalThis & {
  __homeinoStorePromise?: Promise<AgentStore>;
  __homeinoSeedPromise?: Promise<AgentStore>;
  __homeinoStoreMode?: StoreMode;
};

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function storeMode(): StoreMode {
  return globalForResolver.__homeinoStoreMode ?? (hasDatabase() ? "database" : "memory");
}

/** Why the orchestrator is in a given mode — surfaced in the admin panel. */
export function storeModeReason(): string {
  if (!hasDatabase()) return "DATABASE_URL تنظیم نشده — حالت حافظه‌ی درون‌فرآیندی";
  if (storeMode() === "memory") return "جدول‌های ایجنتی در دسترس نبودند — اجرای مایگریشن: npm run db:migrate";
  return "متصل به دیتابیس (Supabase/Postgres)";
}

async function probe(): Promise<AgentStore> {
  if (!hasDatabase()) {
    globalForResolver.__homeinoStoreMode = "memory";
    return memoryAgentStore;
  }
  try {
    // Cheap read that only succeeds when the agentic migration is applied.
    await databaseAgentStore.listTools();
    globalForResolver.__homeinoStoreMode = "database";
    return databaseAgentStore;
  } catch (error) {
    console.warn("[agents] database store unavailable, falling back to in-process store:", (error as Error).message);
    globalForResolver.__homeinoStoreMode = "memory";
    return memoryAgentStore;
  }
}

/**
 * Resolve the store AND make sure the built-in registry exists.
 *
 * Seeding happens here (once per process) rather than only in `ensureSeeded()`
 * so that public entry points — event tracking above all — can match the
 * built-in workflows from the very first request. Without this an event fired
 * before any admin page load would silently match nothing.
 */
export function getStore(): Promise<AgentStore> {
  globalForResolver.__homeinoStorePromise ??= probe().then((store) => seedStore(store));
  return globalForResolver.__homeinoStorePromise;
}

/** Force a re-probe (used after migrations / config changes). */
export function resetStoreResolver() {
  globalForResolver.__homeinoStorePromise = undefined;
  globalForResolver.__homeinoSeedPromise = undefined;
  globalForResolver.__homeinoStoreMode = undefined;
  resetMemoryStore();
}

/**
 * Idempotent bootstrap: makes sure the tool registry, integrations, budgets,
 * built-in agents and the three real workflows exist. Safe to call per request.
 */
export function ensureSeeded(): Promise<AgentStore> {
  globalForResolver.__homeinoSeedPromise ??= getStore();
  return globalForResolver.__homeinoSeedPromise;
}

async function seedStore(store: AgentStore): Promise<AgentStore> {
  const isDb = store.mode === "database";

  // ---- tool registry ----
  try {
    const existingTools = await store.listTools();
    if (!existingTools.length) {
      if (isDb) await databaseStoreSeeds.tools(BUILTIN_TOOLS);
      else memoryStoreSeeds().tools(BUILTIN_TOOLS);
    }
  } catch (error) {
    console.warn("[agents] tool seed skipped:", (error as Error).message);
  }

  // ---- integrations ----
  try {
    const existing = await store.listIntegrations();
    if (!existing.length) {
      if (isDb) await databaseStoreSeeds.integrations(DEFAULT_INTEGRATIONS);
      else memoryStoreSeeds().integrations(DEFAULT_INTEGRATIONS);
    }
  } catch (error) {
    console.warn("[agents] integration seed skipped:", (error as Error).message);
  }

  // ---- budgets ----
  try {
    const existing = await store.listBudgets();
    if (!existing.length) {
      if (isDb) await databaseStoreSeeds.budgets(DEFAULT_BUDGETS);
      else memoryStoreSeeds().budgets(DEFAULT_BUDGETS);
    }
  } catch (error) {
    console.warn("[agents] budget seed skipped:", (error as Error).message);
  }

  // ---- built-in agents ----
  for (const agent of BUILTIN_AGENTS) {
    try {
      const existing = await store.getAgent(agent.key);
      if (existing) {
        // Keep the built-in tool/permission grants in sync with the code.
        if (!existing.tools.length || !existing.permissions.length) {
          await store.updateAgent(agent.key, { tools: agent.tools, permissions: agent.permissions });
        }
        continue;
      }
      await store.createAgent({ ...agent, isBuiltin: true });
    } catch (error) {
      console.warn(`[agents] seed agent ${agent.key} skipped:`, (error as Error).message);
    }
  }

  // ---- built-in workflows ----
  for (const workflow of BUILTIN_WORKFLOWS) {
    try {
      const existing = await store.getWorkflow(workflow.key);
      if (existing) continue;
      await store.createWorkflow({ ...workflow, isBuiltin: true });
    } catch (error) {
      console.warn(`[agents] seed workflow ${workflow.key} skipped:`, (error as Error).message);
    }
  }

  return store;
}

export type { AgentStore };
export * from "./types";
