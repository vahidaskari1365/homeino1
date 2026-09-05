import { describe, expect, it } from "vitest";

// Regression guard for the live backend: only runs when a real Postgres
// DATABASE_URL is configured (skipped in sandboxes / plain CI without one).
const DB = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(DB);

describe.skipIf(!isPostgres)("agent store — database roundtrip", () => {
  it(
    "resolves built-in agents by KEY (not only uuid) from the database",
    async () => {
      const { ensureSeeded } = await import("./index");
      const store = await ensureSeeded();
      expect(store.mode).toBe("database");

      // regression: getAgent('designer') used to crash with
      // `invalid input syntax for type uuid` because the key was also
      // compared against the uuid id column.
      const designer = await store.getAgent("designer");
      expect(designer?.key).toBe("designer");
      expect(designer!.tools.length).toBeGreaterThan(0);

      const workflow = await store.getWorkflow("customer-view-intelligence");
      expect(workflow?.key).toBe("customer-view-intelligence");

      const agents = await store.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(6);
    },
    30_000,
  );
});
