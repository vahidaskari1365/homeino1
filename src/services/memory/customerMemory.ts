// ============================================================
// HOMEINO — CUSTOMER MEMORY LAYER
//
// Source of truth: the database (Supabase `customer_memories`) — or the
// in-process store when no DATABASE_URL is configured. localStorage is never
// used as a memory source.
//
// Mem0 (mem0ai/mem0, Apache-2.0) is supported as an optional mirror: when
// MEM0_API_KEY is set, every memory operation is also sent to Mem0's platform
// API (add / search / list / delete). The local record stays authoritative so
// the site never depends on an external service.
//
// The API shape intentionally mirrors Mem0's own contract
// (messages/user_id/agent_id/run_id + relevance-scored search results) so the
// two stores stay interchangeable.
// ============================================================
import type { MemoryKind, MemoryProvider, MemoryRecord } from "../agents/types";
import { getStore } from "../agents/store";

export type { MemoryKind, MemoryProvider, MemoryRecord };

const MEM0_BASE = () => (process.env.MEM0_BASE_URL ?? "https://api.mem0.ai").replace(/\/+$/, "");
const MEM0_KEY = () => process.env.MEM0_API_KEY ?? "";
export const isMem0Configured = () => Boolean(MEM0_KEY());

async function mem0Fetch(path: string, init: RequestInit & { method: string }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${MEM0_BASE()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${MEM0_KEY()}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`mem0 HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface Mem0Memory {
  id?: string;
  memory?: string;
  hash?: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

/** Optional Mem0 mirror — never throws, never blocks the local write. */
export const mem0Mirror = {
  async add(userId: string, record: { kind: MemoryKind; key: string; text?: string; value?: Record<string, unknown>; agentKey?: string; runId?: string }) {
    if (!isMem0Configured()) return;
    try {
      await mem0Fetch("/v2/memories/", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: record.text ?? `${record.kind}:${record.key}` }],
          user_id: userId,
          agent_id: record.agentKey ?? "homeino",
          run_id: record.runId,
          metadata: { kind: record.kind, key: record.key, ...(record.value ?? {}) },
          output_format: "v1.1",
        }),
      });
    } catch (error) {
      console.warn("[memory] mem0 mirror add failed:", (error as Error).message);
    }
  },
  async search(userId: string, query: string, limit = 10): Promise<MemoryRecord[]> {
    if (!isMem0Configured()) return [];
    try {
      const payload = (await mem0Fetch("/v2/memories/search/", {
        method: "POST",
        body: JSON.stringify({ query, filters: { user_id: userId }, limit }),
      })) as Mem0Memory[] | { results?: Mem0Memory[] };
      const rows = Array.isArray(payload) ? payload : payload.results ?? [];
      return rows.map((row) => ({
        id: row.id ?? row.hash ?? "",
        userId,
        kind: ((row.metadata?.kind as MemoryKind) ?? "note") as MemoryKind,
        key: String(row.metadata?.key ?? row.id ?? "mem0"),
        value: (row.metadata ?? {}) as Record<string, unknown>,
        text: row.memory,
        importance: 1,
        hits: 0,
        metadata: row.metadata ?? {},
        score: row.score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.warn("[memory] mem0 mirror search failed:", (error as Error).message);
      return [];
    }
  },
  async remove(userId: string, memoryId: string) {
    if (!isMem0Configured() || !memoryId) return;
    try {
      await mem0Fetch(`/v1/memories/${memoryId}/`, { method: "DELETE" });
    } catch (error) {
      console.warn("[memory] mem0 mirror delete failed:", (error as Error).message);
    }
  },
};

/** Local (Supabase / in-process) memory provider. */
export const localMemoryProvider: MemoryProvider = {
  name: "homeino-local",
  async add(userId, record) {
    const store = await getStore();
    return store.addMemory(userId, record);
  },
  async search(userId, query, opts) {
    const store = await getStore();
    const all = await store.listMemories(userId, { kind: opts?.kind, limit: 200 });
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, opts?.limit ?? 20);
    const scored = all
      .map((m) => {
        const haystack = `${m.key} ${m.text ?? ""} ${JSON.stringify(m.value ?? {})}`.toLowerCase();
        const overlap = q
          .split(/\s+/)
          .filter(Boolean)
          .reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
        return { memory: m, score: overlap / Math.max(1, q.split(/\s+/).length) + m.importance * 0.05 + m.hits * 0.01 };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts?.limit ?? 10);
    return scored.map((entry) => ({ ...entry.memory, score: Number(entry.score.toFixed(4)) }));
  },
  async all(userId, opts) {
    const store = await getStore();
    return store.listMemories(userId, opts);
  },
  async remove(userId, key, kind) {
    const store = await getStore();
    return store.deleteMemory(userId, kind, key);
  },
};

/** The facade every agent uses. */
export const customerMemory = {
  provider(): MemoryProvider {
    return localMemoryProvider;
  },
  async remember(
    userId: string | null | undefined,
    record: { kind: MemoryKind; key: string; text?: string; value?: Record<string, unknown>; importance?: number; entityType?: string; entityId?: string; agentKey?: string; runId?: string; metadata?: Record<string, unknown> },
  ): Promise<MemoryRecord | null> {
    if (!userId) return null;
    const saved = await localMemoryProvider.add(userId, {
      kind: record.kind,
      key: record.key,
      text: record.text,
      value: { ...(record.value ?? {}), ...(record.runId ? { runId: record.runId } : {}) },
      importance: record.importance ?? 1,
      hits: 1,
      entityType: record.entityType,
      entityId: record.entityId,
      agentKey: record.agentKey,
      metadata: record.metadata,
    });
    // Fire-and-forget mirror — the local write already succeeded.
    void mem0Mirror.add(userId, { kind: record.kind, key: record.key, text: record.text, value: record.value, agentKey: record.agentKey, runId: record.runId });
    return saved;
  },
  async recall(userId: string | null | undefined, query = "", opts?: { kind?: MemoryKind; limit?: number }): Promise<MemoryRecord[]> {
    if (!userId) return [];
    const local = await localMemoryProvider.search(userId, query, opts);
    if (!isMem0Configured()) return local;
    const remote = query ? await mem0Mirror.search(userId, query, opts?.limit ?? 5) : [];
    // Merge without duplicating keys; local records win.
    const seen = new Set(local.map((m) => `${m.kind}:${m.key}`));
    return [...local, ...remote.filter((m) => !seen.has(`${m.kind}:${m.key}`))].slice(0, opts?.limit ?? 20);
  },
  async all(userId: string | null | undefined, opts?: { kind?: MemoryKind; limit?: number }): Promise<MemoryRecord[]> {
    if (!userId) return [];
    return localMemoryProvider.all(userId, opts);
  },
  async forget(userId: string | null | undefined, kind: MemoryKind, key: string): Promise<boolean> {
    if (!userId) return false;
    return localMemoryProvider.remove(userId, key, kind);
  },
  /** Which memory backend is live — shown in the admin panel. */
  status() {
    return {
      primary: "supabase/in-process (customer_memories)",
      mem0: isMem0Configured() ? "connected (mirror)" : "not configured",
    };
  },
};
