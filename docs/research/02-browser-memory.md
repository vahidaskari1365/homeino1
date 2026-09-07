# Research 02 — Browser Automation + Agent Memory (repos audit)

Task 15-3b · research-only · audited from `git clone --depth 1` (2026-09-05) + GitHub HTML metadata (API rate-limited).
Scope: Homeino is a single Next.js 16 codebase (React 19, drizzle + Supabase Postgres w/ pgvector, vitest, no self-managed Docker in prod, minimal deps, UI locked). Existing assets: agent orchestrator, `browserTask` tool stub (requiresApproval + allowedDomains), customer memory tables + preference engine on Supabase.

## 1. browser-use/browser-use

Facts: MIT (`LICENSE`, © 2024 Gregor Zunic) · ~112.8k stars · last commit 2026-09-05 (`e25ab65`) · not archived · v0.13.10.
Runtime: **Python ≥3.11** (`pyproject.toml` `requires-python`); heavy dep set (openai, anthropic, google-genai, mcp, pillow, posthog…). **No Playwright** — drives Chrome over CDP via `cdp-use` (pyproject.toml:43). Runs as Python lib, CLI, or MCP server (`server.json`, `mcp-name: com.browser-use/browser-use`); hosted alternative = Browser Use Cloud.
Task declaration: imperative task string on `Agent(task=…, output_model_schema=…)` (`browser_use/agent/service.py:134-138`); structured output via **pydantic** schema — task is auto-enhanced with the schema (`service.py:364,374,611-627`). README claims: form filling, data extraction, custom tools/prompts, "structured output, fine-grained browser control" (README §"Python library"). No explicit self-healing/caching claims in README; no Playwright caching layer to reuse.
Integration path for Homeino: Python side-service/subprocess (violates "no Python side-services, no Docker") or paid Cloud REST API (external dependency + per-task cost). Node adapter would still need a Python runtime.
**Verdict: REJECT (as runtime). REFERENCE** its task+schema declaration style for our `browserTask` stub (task string + zod schema ≈ their task + pydantic `output_model_schema`).

## 2. browserbase/stagehand

Facts: MIT (`LICENSE`, © 2024 Browserbase Inc.) · ~24.2k stars · last commit 2026-09-03 (`d4f16a9`) · not archived · v4.0.0 monorepo (`packages/sdk-ts|sdk-python|sdk-go|protocol|extension`).
Runtime: **TypeScript/Node** (`packages/sdk-ts` engines: node ≥22.18); browsers via `localBrowser` factory (local Chromium; `src/index.ts:50`, `src/browser/factories.ts:233`) **or** Browserbase cloud (`browserbase.launch`); no Python needed for the TS SDK. LLM required for agentic primitives (any provider via `model` config).
Task declaration: hybrid — Playwright-style deterministic calls (`goto`, `locator`) + NL primitives `act` / `observe` / `extract` with **zod** structured output (README example: `extract("…", z.object({author, title}))`). Claims: self-healing actions ("when sites change, Stagehand detects it and refreshes how the actions happen", README §"Self-healing primitives"), a11y-tree trimming for token efficiency, batch commands, OTel, closed Shadow DOM/OOPIF support. No result-cache claims (healing is live, not cached).
Integration path: **in-process TS library** — fits Next.js Node runtime directly; `browserTask({task, outputSchema, allowedDomains})` → Stagehand `goto` + `act`/`extract`; approvals/allowedDomains stay in our orchestrator (we control the call site). Caveats: v4 is young (breaking vs v3 docs), needs a Chromium binary on the host, and `extract/act` calls consume LLM tokens.
**Verdict: ADAPT** — the only browser engine that deserves an adapter; wrap it behind the existing permissioned `browserTask`, keep it optional/gated.

## 3. letta-ai/letta

Facts: Apache-2.0 (`LICENSE`) · ~24.6k stars · last commit 2026-08-23 (`4511fa0`) · **repo is now a landing page**: source moved to `letta-ai/letta-code` (npm `@letta-ai/letta-code`); retired V1 Python server preserved on `archive` branch — README: "unsupported, receives no fixes or security updates, and should not be used in production".
Runtime: separate **App Server** (`letta server`) / desktop app / Letta Cloud; the product is a full stateful-agent platform (agent harness, TUI, channels), not a library. Storage was its own DB layer (SQLite/Postgres) + vector archival memory.
Supabase replaceability: Homeino's needs (per-customer preference/profile rows, session context, retrieval) are plain relational + pgvector concerns. Letta would add an external server + its own DB to host **core/archival/recall memory blocks** — infrastructure without unique value for a marketplace assistant; the memory-block *concept* (structured, self-editable context blocks) can be mimicked with our tables.
**Verdict: REJECT** (dead-end repo; replacement platform is a heavyweight server). REFERENCE memory-blocks design only.

## 4. mem0ai/mem0

Facts: Apache-2.0 (`LICENSE`) · ~64.8k stars · last commit 2026-09-04 (`dae67f7`) · not archived. OSS Python lib (`pip mem0ai`), TS SDK (`npm mem0ai`, `mem0-ts/src/{client,common,oss,community}`), managed platform, and optional REST server (`server/` w/ Dockerfile+alembic).
Storage: pluggable vector stores **including `mem0/vector_stores/pgvector.py` and `supabase.py`** (Supabase store uses `vecs` client + connection string, `vector_stores/supabase.py:26-45`) + a history DB (SQLite default, `mem0/memory/storage.py`) — i.e., it *can* run as a library against our Postgres, but still brings its own schema, history store, and an LLM extraction loop.
Algorithm (README §"New Memory Algorithm (April 2026)"): **ADD-only single-pass extraction** (no UPDATE/DELETE; memories accumulate), agent-confirmed facts as first-class, **entity linking** for retrieval boosting, **multi-signal retrieval** (semantic + BM25 + entity, fused in parallel), temporal reasoning. Honesty note: top benchmark scores "reflect Mem0's managed platform, which includes proprietary optimizations not available in the open-source SDK".
Supabase replaceability: yes — the *core value* is the extraction/fusion recipe, not the store; Homeino already has memory tables + a preference engine. Port the recipe: append-only fact extraction w/ one LLM call, tag/entity linkage, ts_rank (BM25-ish) + pgvector + RRF fusion (Postgres-native), `updated_at`-aware ranking. Adding mem0 would duplicate our engine and add a config/history surface.
**Verdict: REFERENCE** (copy the algorithm patterns into our Supabase engine; do NOT add the service).

## 5. softchris/ecommerce-agent-memory

Facts: 2 stars · **no LICENSE file in repo** (root = README, app.py, db.py, products.py, docs/, static/; nothing in README either) ⇒ code may not be copied. Last commit 2026-05-20.
Stack: Python FastAPI + Microsoft Agent Framework + Foundry Local/Ollama + **SQL Server in Docker** — orthogonal to Homeino.
Patterns worth copying (cite):
- Schema: `Users` / `Sessions` / `ChatHistory` with FKs (`db.py:43-67`) and a history provider class `CommerceHistoryProvider(BaseHistoryProvider)` (`db.py:145`) — clean separation of session persistence from agent logic.
- **Deterministic fallback**: `recommendations` tries LLM then "Fallback to keymatch if LLM fails" (`app.py:155`) — always return a usable result.
- `KEYWORD_MAP` synonym expansion mapping user language → product tags/categories (`products.py:38-60`) — a zero-vector baseline matcher, good cheap first layer under pgvector.
- Preference extraction is prompt-driven ("Ask about their interests… Remember what they tell you", `app.py:37`) — same intent as our preference engine; no vector search anywhere.
**Verdict: REFERENCE** (patterns only; no license ⇒ no code reuse).

## 6. YufanPeter/E-commerce-AI-Agent ("CartPilot")

Facts: MIT (`LICENSE`, © 2026 Yufan Shi) · 7 stars · last commit 2026-07-20 · ByteDance "Outstanding Project". Stack: FastAPI + SwiftUI iOS (not adoptable), but the richest architecture here.
Patterns worth copying (cite):
- **Agent shape**: `router → tool → composer` — "The LLM interprets intent and writes the response. Deterministic tools perform search, comparison, and cart mutations" (README §Architecture). Mirrors Homeino's orchestrator: LLM chooses, tools act.
- **Hybrid search**: structured filters built from NL query (`backend/search/where_builder.py`, `query_understanding.py`) applied first; **BM25 fused with dense rankings via RRF over the filtered subset** — `backend/search/search_service.py:208-236` (`rrf_fuse([vec_order, bm25_order])`); optional cross-encoder rerank (`backend/rag/reranker.py`). Directly portable: drizzle SQL = filters; `ts_rank` = BM25-ish; pgvector = dense; RRF in SQL.
- **Grounded SKU/price/stock**: `products`/`product_skus`/`product_price_ranges`/`product_descriptions`/`product_faqs` in `backend/db/init.sql`; "product_skus: source of truth for variants, SKU prices, and cart settlement" (init.sql:28-35); budget filters check *some SKU satisfies price* (init.sql:9-10,29). Answers our grounded-price requirement: never let the LLM state price/stock — read from DB.
- **Negative constraints** at product level ("sunscreen without alcohol") — store structured ingredient/attr flags to filter, don't rely on text match.
- **Memory schema**: `user_preferences` (one JSON row per user, `backend/store/user_memory_store.py:60-70`) + **`preference_undo_tokens`** with `field/value_json/before_json/after_json/used` single-use undo tokens (`user_memory_store.py:72-86`) — preference writes are auditable and reversible; merge semantics are unit-tested (`backend/search/tests/test_preference_merge.py`). Also reference resolution ("the second one") + session context.
**Verdict: ADAPT** — port its patterns (RRF hybrid search, undo-token preference writes, SKU-grounded facts) onto drizzle/Supabase; no runtime dependency.

## Summary table

| Repo | License | Stars | Last push | Verdict | One-line reason |
|---|---|---|---|---|---|
| browser-use/browser-use | MIT | ~112.8k | 2026-09-05 | REJECT runtime / REFERENCE | Python ≥3.11 side-service or paid cloud; steal task+schema idea only |
| browserbase/stagehand | MIT | ~24.2k | 2026-09-03 | ADAPT | TS SDK, local Chromium, act/observe/extract + zod, self-healing — maps 1:1 onto `browserTask` |
| letta-ai/letta | Apache-2.0 | ~24.6k | 2026-08-23 | REJECT | Repo is a landing page; V1 server archived "not for production"; platform ≠ library |
| mem0ai/mem0 | Apache-2.0 | ~64.8k | 2026-09-04 | REFERENCE | Supports Supabase/pgvector but adds extraction stack we already own; copy recipe, not service |
| softchris/ecommerce-agent-memory | none | 2 | 2026-05-20 | REFERENCE | Deterministic-fallback + keyword-map patterns; no license ⇒ no code reuse |
| YufanPeter/E-commerce-AI-Agent | MIT | 7 | 2026-07-20 | ADAPT | RRF hybrid search, undo-token preference schema, SKU/stock grounding — port to drizzle |

## Integration recommendation (Homeino)

1. **Browser:** gate Stagehand behind the existing `browserTask` permission stub — one thin TS adapter (`task`, `outputSchema`, `allowedDomains`, `requiresApproval` preserved), LOCAL `localBrowser` Chromium, never auto-run without approval. No other browser engine gets an adapter (browser-use ⇒ Python/cloud; Letta ⇒ N/A).
2. **Memory:** keep the in-house Supabase engine; port three patterns from CartPilot/mem0: (a) filters→BM25→pgvector→**RRF fusion** for product search; (b) **append-only preference extraction** with single-use **undo tokens** (before/after JSON); (c) **SKU/price/stock always read from DB**, LLM only composes. Keyword-synonym layer (repo 5) as cheap fallback when embeddings/LLM are down.
3. **No new services**: nothing here justifies a Python side-service, extra DB, or Docker in prod.

**Q: Can Supabase+pgvector fully cover memory?** — Yes. Every memory feature these repos implement (session history, preference rows, undoable writes, semantic+lexical fusion, recency/temporal ranking) maps onto Postgres relational tables + pgvector + `ts_rank` + RRF with drizzle. What mem0/letta add is platform (servers, history DBs, dashboards), not capability Homeino lacks; their algorithmic ideas are portable in a few SQL/TS functions. Only revisit if Homeino later needs cross-user entity graphs or benchmark-scale LongMemEval recall.

**Q: Which browser engine, if any, deserves the adapter?** — Stagehand (`@browserbasehq/stagehand`), and only it: TypeScript in-process (no Python, no Docker), local-browser mode, zod structured `extract` for our tool outputs, and self-healing for brittle third-party storefront pages. Ship it as an optional dependency wired to the permissioned `browserTask`; if a task never needs a real browser, keep Playwright-free and drop the dep.
