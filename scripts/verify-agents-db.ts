// ============================================================
// HOMEINO — verify the agent store runs in DATABASE mode:
//   npx esbuild scripts/verify-agents-db.ts --bundle --platform=node \
//     --format=esm --alias:@=./src --external:pg --external:dotenv \
//     --outfile=.verify-bundle.mjs && node .verify-bundle.mjs
// ============================================================
import dotenv from "dotenv";
dotenv.config();
import { ensureSeeded, storeMode, storeModeReason } from "@/services/agents/store";
import { BUILTIN_AGENTS, BUILTIN_TOOLS, BUILTIN_WORKFLOWS } from "@/services/agents/defaults";

async function main() {
  console.log("[agents] expected built-ins:", BUILTIN_AGENTS.length, "agents,", BUILTIN_TOOLS.length, "tools,", BUILTIN_WORKFLOWS.length, "workflows");
  const store = await ensureSeeded();
  console.log("[agents] store mode:", store.mode, "| resolver says:", storeMode());
  console.log("[agents] reason:", storeModeReason());

  const agents = await store.listAgents();
  console.log(`[agents] in store: ${agents.length}`);
  for (const a of agents) {
    console.log(`  • ${a.key} — ${a.name} [${a.status}] tools=${a.tools.length} perms=${a.permissions.length}`);
  }
  const tools = await store.listTools();
  const workflows = await store.listWorkflows();
  console.log(`[agents] tools in store: ${tools.length} | workflows: ${workflows.length}`);

  const missing = BUILTIN_AGENTS.filter((b) => !agents.some((a) => a.key === b.key));
  if (store.mode !== "database") { console.error("✗ NOT in database mode"); process.exit(1); }
  if (missing.length) { console.error("✗ missing agents:", missing.map((m) => m.key).join(", ")); process.exit(1); }
  console.log("✓ ALL BUILT-IN AGENTS LIVE IN DATABASE");
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error("[agents] FAILED:", err); process.exit(1); });
