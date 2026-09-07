# Codebase Review — 2026-09-07

Two-axis review (Standards + Architecture) run with the mattpocock/skills
code-review methodology: the smell baseline (Fowler, Refactoring ch.3) as the
standards axis, deep-module vocabulary (module/interface/seam/adapter/depth/
locality) as the architecture axis. Both axes ran as separate read-only
sub-agents over the agentic core, AI gateway, workflows, repositories and
sampled UI/API files.

## Standards axis

### Hard violations of documented invariants

1. `src/repositories/README.md` Rule 1 — "never import from `@/data/*` outside
   `src/repositories/` and sitemap/seed scripts" — is violated by ~80 files
   (legacy mock-data era). Highest impact: `src/services/ai/productAdvice.ts`,
   `src/app/products/[slug]/ProductDetailClient.tsx`, `src/app/search/page.tsx`,
   `src/components/layout/Header.tsx`. The documented "swap only the repository
   implementation" promise is broken by construction.
2. `src/lib/server/catalog.ts` claims to be "the single seam" while
   `src/repositories/` is the documented one — two competing seams.

### Upheld (verified, no violation)

- Money as integers, no float math (`db/schema/_base.ts`).
- Secrets never stored in DB — `secretEnvVar` name-only pattern.
- "LLM must never fabricate SKU/price/stock" — enforced by outputGuard in runtime.
- "Never fake success" — honest `dataState` degradation everywhere.

### Top judgement-call smells (by risk)

1. Dead code: `src/lib/server/ai/orchestrator.ts` + `aiProviders.ts` imported by nothing → delete.
2. Duplicated product mapper with drift: `repositories/products.ts:toDomain` vs `lib/server/catalog.ts:mapSerialized` (drops colors/materials/stock; limits 200 vs 100) → keep one mapper.
3. Three parallel provider-resolution stacks: `ai/provider.ts`, `ai/llm/index.ts`, `agents/llmGateway.ts` → extract one chain shape.
4. `num`/`str` coercers duplicated in `tools.ts`, `runtime.ts`, `handlers/types.ts` (runtime's `str` doesn't trim) → consolidate.
5. Two UI-safe product serializers (`publicProduct` vs `toPublic`) → move to catalog.
6. Tool gating exists twice (`executeTool` + `handlerContext.callTool`), and `toolContext.callTool` bypasses the approval gate → one gate.
7. Seven near-identical search-query literals in the widening ladder (`shoppingAssistant.ts`) → derive from a base object.
8. `BUILTIN_TOOLS` metadata hand-mirrors executable `TOOL_DEFINITIONS` → generate one from the other.

Overall: high-standard, production-grade agentic core; debt is concentrated in
the not-yet-retired `@/data` mock era and duplicated plumbing generations.

## Architecture axis (deep modules)

### Deepest modules

- `agents/runtime.ts` — `runAgentByKey()` hides external-runtime delegation,
  activation/budget gates, permission-filtered tools, approval pausing,
  bounded retries, output guarding, execution logs.
- `agents/llmGateway.ts` — `complete()/completeJson()/embed()` conceal 5
  providers, cost estimation, never-throw degradation, JSON corrective retry.
- `workflows/engine.ts` — 1,036 lines of node execution behind `runWorkflow()`.

### Shallowest / worst

- Four parallel LLM stacks (`ai/provider.ts`, `ai/llm/`, `agents/llmGateway.ts`,
  stale `lib/server/ai/aiProviders.ts`) — provider swap smeared, not hidden.
- `AgentStore` (~50 methods over 10 subdomains; database adapter 1,331 lines) → split per domain.
- `repositories/products.ts` — per-method fallback duplication; whole-pool fetch + JS filter.

### Real vs hypothetical seams

- Real (2+ live adapters): AiProvider (5), agent runtime (local/dify/langflow),
  workflow runtime (same trio), store (memory/database, roundtrip-tested).
- Hypothetical: `runtime: "ollama"` validated but silently falls back to local.

### Locality

"Add one builtin agent with tools" touches ~6 files today (defaults.ts tools
metadata + agents list, tools.ts executors, handler + handlers/index.ts,
optional permissions, SQL seed mirror, sync test). The declarative handler
proves ~2 should suffice.

### Testability

Main seams are tested through public interfaces (chatScenarios, prompt-gap,
database.roundtrip, blueprints). One internal helper reached directly
(`parseProductContext`).

### Top deepening opportunities

1. Collapse the four LLM stacks into one gateway.
2. Seed agent/tool rows from `defaults.ts` instead of hand-mirrored SQL.
3. Split `AgentStore` per domain; wrap repositories in one fallback decorator.

> These are backlog items on purpose — the owner asked for zero breakage of the
> current implementation; none of the above is required for the agentic
> marketplace prompt to function.
