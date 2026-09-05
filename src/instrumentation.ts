// ============================================================
// HOMEINO — SERVER INSTRUMENTATION (runs once when the Node server boots)
//
// Two jobs, both DB-gated so a plain build/preview never touches Postgres:
//   1. Bootstrap the agent store (seeds built-in agents/tools/workflows from
//      code into the DB on first boot — idempotent).
//   2. Start the in-process workflow scheduler — until now `startScheduler`
//      existed but was NEVER called, so daily/interval workflows (e.g. the
//      seeded customer-intelligence workflows at 09:00) silently never ran
//      unless an external cron hit /api/automation/scheduler/tick manually.
//
// Env guards:
//   • NEXT_RUNTIME !== nodejs → skip (edge middleware etc.)
//   • no DATABASE_URL        → skip (mock mode, nothing to schedule)
//   • VERCEL=1               → skip (serverless — use the tick API + cron)
//   • HOMEINO_SCHEDULER_DISABLED=true → skip (escape hatch, honored by
//     startScheduler itself)
// ============================================================
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL || process.env.VERCEL === "1") return;

  try {
    const { ensureSeeded } = await import("@/services/agents/store");
    await ensureSeeded().catch((error: unknown) => {
      console.warn("[homeino] agent store bootstrap deferred:", (error as Error).message);
    });

    const { startScheduler } = await import("@/services/workflows/scheduler");
    // 5 minutes: due workflows run soon after their slot, without hammering
    // the DB. The handle is unref'd — it never keeps the process alive.
    const handle = startScheduler(300_000);
    if (handle) console.log("[homeino] automation scheduler started — due workflows tick every 5 min");
  } catch (error) {
    console.warn("[homeino] instrumentation bootstrap skipped:", (error as Error).message);
  }
}
