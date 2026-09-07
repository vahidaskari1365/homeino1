# Research 03 — E-commerce Agents + Recommendation Engines (repos audit)

Task 15-3c · research-only · audited from `git clone --depth 1` (2026-09-05) + GitHub HTML metadata (API rate-limited; star counts + licenses cross-checked against each repo's own `LICENSE` file).
Scope: Homeino = single Next.js 16 App Router codebase (React 19, TS, drizzle + Supabase Postgres, pgvector available, vitest, minimal deps). Existing assets: agent orchestrator (`src/services/agents/orchestrator.ts`, `nlu.ts`, `llmGateway.ts`, `catalog.ts`), recommendation stack (`src/services/recommendations/{recommendationEngine,ranking,productMatching}.ts`, `src/lib/similarProducts.ts`), memory (`src/services/memory/{customerMemory,preferenceEngine}.ts`), agent-run events (`src/services/agents/store/types.ts` events section).

## Summary

| # | Repo | License | Stars | Last commit | Verdict |
|---|------|---------|-------|-------------|---------|
| 1 | VIVPM/ecommerce-agent | MIT | 1 | 2026-06-03 | **ADAPT** (guardrail patterns) |
| 2 | Pukar77/Ecommerce-Agent | none ("Rimal License" claim in README) | 4 | 2026-05-03 | **REFERENCE** (Supabase-as-inventory, with a fix) |
| 3 | facebookresearch/PAHF | MIT (Meta) | 57 | 2026-04-26 | **REFERENCE** (feedback-loop design) |
| 4 | rutgerswiselab/MemRec | none (no LICENSE file) | 83 | 2026-07-28 | **REFERENCE** (architecture idea only — no code reuse) |
| 5 | Max-Eee/E-commerce-recommender | MIT | 9 | 2025-12-15 | **ADAPT** (closest sibling: TS in-codebase hybrid recommender) |
| 6 | gorse-io/gorse | Apache-2.0 (NOT AGPL) | 9,817 | 2026-08-28 | **REJECT** (service) / **REFERENCE** (pipeline patterns) |

## 1. VIVPM/ecommerce-agent (React + FastAPI shopping agent)

Facts: MIT (`LICENSE`, © 2026 Vivek P Marakumbi) · 1 star · last commit 2026-06-03 · FastAPI + React 19 + Gemini 2.5 Flash + Postgres (Neon) + Pinecone. Single-purpose repo, but the most engineering-mature of the four agents: 200-scenario LLM-as-judge eval suite, load tests, OTel.
Patterns worth copying (all verified in code, not just README):

- **Read-only engine for LLM-generated SQL** — `backend/app/db/database.py:38-55`: a second SQLAlchemy engine where every connection runs `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` + `SET statement_timeout = SQL_STATEMENT_TIMEOUT_MS` (15s for LLM SQL, 30s for app SQL). Homeino's text-to-SQL tool should do exactly this: a dedicated pg user / `SET TRANSACTION READ ONLY` + statement timeout, distinct from the drizzle write pool (`src/lib/server`).
- **Prompt-embedded SQL guardrails** — `backend/app/sql.py:116-123` bakes "use an aggregate, never a bare column with LIMIT 1" and price-comparison subquery templates into the generation prompt; README §"Honest by construction" refuses filters the data can't support (colour/size) instead of inventing rows. Mirrors Homeino's "never returns invented rows" contract in `productMatching.ts`.
- **Context rewrite before routing** — `backend/app/memory.py`: bounded history (6 msgs), rewrite follow-ups ("any cheaper?", "which of these is waterproof?") into standalone queries, with a critical rule to carry forward the previous result's constraints and never rewrite away "my saved items". Directly applicable to `orchestrator.ts`/`nlu.ts` intent extraction for Persian follow-ups ("ارزون‌تر ندارید؟").
- **LLM routing via tool docstrings** — `backend/app/agent.py:20-56`: three tools whose docstrings are the routing contract; routing decision is cached in a Postgres `llm_cache` (`cache.py`, fail-open). Homeino can cache (intent → agent) decisions in its events/store tables.
- **Price-drop alerts as a live join, no scheduler** — `POST/GET /api/saved` joins saved products to current prices and exposes the delta since save (README §API endpoints, `Sidebar.jsx` price-drop badge). Homeino can add `target_price`/`saved_price` columns on `wishlist_items` and compute deltas in the wishlist read path — no cron.
- **Bayesian (confidence-weighted) "top rated"** — README §Key Features: a 4.7-from-50 can't beat 4.6-from-500. Cheap to add to `ranking.ts` (`popularity`/review factors) using Homeino's `reviews` table.
- **Eval harness** — `backend/test/{evaluate_agent_tuned.py, eval_rubric.md, test_questions_200.json}`: routing pass/fail + faithfulness + relevance judged by an LLM against a rubric; vitest equivalents (fixture messages → assert routed agent + grounded SKUs) would be Homeino's version.

**Verdict: ADAPT** — copy the guardrail/cache/alert/eval *patterns*; do not adopt FastAPI/Pinecone/Neon.

## 2. Pukar77/Ecommerce-Agent (Groq + Qdrant + Supabase)

Facts: 4 stars · last commit 2026-05-03 · **no LICENSE file**; README §License claims a custom "Rimal License" ⇒ code may not be safely reused. LangChain AgentExecutor + regex intent router (`Backend/Rag/main_05.py:38-47` `BUY_PATTERNS`/`STOCK_PATTERNS`) + PDF-catalog RAG in local Qdrant.
Only two things are relevant:

- **Supabase as the live inventory source behind agent tools** — `Backend/Agent/tools/database_tools.py`: `check_stock(product_id)` (`.select(...).eq(...).single()`) and `buy_product(product_id)` (refuse when stock ≤ 0, else decrement). This validates Homeino's "Supabase = source of truth" approach; the agent never owns inventory.
- **Anti-pattern to avoid**: `buy_product` does read-then-write decrement (non-atomic — two concurrent buys can oversell) and runs with the anon key server-side. Homeino's cart/order path must keep decrements atomic in Postgres (single `UPDATE inventory SET qty = qty - n WHERE qty >= n` / RPC in a transaction) and expose the agent only a *checked-out-by-user* tool, never raw stock writes.

**Verdict: REFERENCE** (and as a warning); regex routing is strictly weaker than Homeino's existing `nlu.ts` + LLM routing; PDF/Qdrant RAG is unnecessary when the catalog is already relational.

## 3. facebookresearch/PAHF (Personalized Agents from Human Feedback)

Facts: MIT (`LICENSE`, © Meta Platforms) · 57 stars · last commit 2026-04-26 · Python research code (GPT-4o) for a **ShoppingAgent** (`agents/shopping_agent.py`, 1,158 lines) and embodied agent; memory banks are SQLite or FAISS (`memory/banks.py:97-106`, abstract `MemoryBank.add/search`).
Relevant design ideas (README §Overview):

- **Pre-action feedback** — the agent must ask a clarifying question when preferences are underdetermined before choosing (`prompts/shopping_prompts.py:74-109`: "You MUST ask for clarification when…"), i.e. clarify-then-act, not guess-then-apologize. Maps to Homeino orchestrator: when `effectiveProfile()` (preferenceEngine) lacks a dimension the chosen agent needs, return a clarifying-question turn instead of a low-confidence recommendation.
- **Post-action feedback into memory** — `_generate_post_feedback` + `_process_feedback_into_memory` (`shopping_agent.py:161-247`) convert the user's correction into a durable memory entry for the next session. Same shape as Homeino: `recommendationEngine.ts` `recordRecommendationFeedback` → `customerMemory` write → next run's profile snapshot.
- **Memory bank interface** — the tiny `MemoryBank` ABC (add/search/top-k) is a good shape-check for `customerMemory.ts`: keep retrieval top-k small and inject only into prompts.

**Verdict: REFERENCE** — research pipeline (persona datasets, eval phases) not reusable; the clarify-before-acting and correction-into-memory loops are the transferable parts.

## 4. rutgerswiselab/MemRec (ACL 2026)

Facts: 83 stars · last commit 2026-07-28 · **no LICENSE file in the repo** ⇒ no code reuse permitted; cite the paper (README bibtex `chen2026memrec`, aclanthology 2026.acl-long.2061) as a design reference only. Python/PyTorch, InstructRec datasets, CUDA-oriented.
Architecture idea (README §"Collaborative Memory-Augmented Agentic Recommender System"): decouple memory management from reasoning — a cheap model (`LM_Mem`) maintains and *distills* a collaborative memory graph (UserItemGraph + neighbor pruner, `src/memory/graph.py:10`, `pruner.py:13`, `packer.py`), and only a high-signal packed context is passed to the expensive recommender LLM (`LLM_Rec`).

- Mapping for Homeino: keep memory maintenance cheap and asynchronous — `customerMemory`/`preferenceEngine` already summarize; add a *collaborative* layer (co-purchase/co-style graph derivable in SQL from `order_items` + `product_styles`) that feeds compact "customers who bought this also…" context into `llmGateway` prompts. Never ship raw event dumps to the LLM (their `packer.py` discipline).
- The two-model split (small memory writer vs large reasoner) matches Homeino's cost posture: use the cheapest gateway model for memory extraction, reserve large models for final answers.

**Verdict: REFERENCE** (architecture; unlicensed code + CUDA/training pipeline makes direct use impossible at Homeino's scale anyway).

## 5. Max-Eee/E-commerce-recommender (Next.js hybrid recommender)

Facts: MIT (`LICENSE`) · 9 stars · last commit 2025-12-15 · a **medusa-next storefront fork** (`package.json` name `medusa-next`; license header © 2022 Medusa) with recommendations bolted on in pure TypeScript inside the Next.js app: `src/lib/recommendation-engine.ts` (712 lines) + `src/lib/gemini-service.ts` (771 lines, Gemini explanations + Unsplash images). No separate service, no Python — the strongest proof-of-concept for Homeino's "recommendations live in the Next.js codebase" position.
Concrete mechanics worth porting (verified in code):

- **Engagement scoring with signed weights** — `recommendation-engine.ts:6-66`: viewDuration (≤1.0×0.3), viewCount, interaction types, cart add +0.5 / remove −0.3, checkout +0.7, purchase +1.5 (repeat capped +2.0), rating 0.4, **30-day linear recency decay** (+0.3 max). Homeino's `RANKING_WEIGHTS` (`ranking.ts:13-25`) already has `behaviorSimilarity`/`recentInterest` factors; this gives a principled formula for turning the interaction-event stream into those signals.
- **Cold-start degradation ladder** — `generateRecommendations` (`recommendation-engine.ts:637-712`): with other users' data → 5-way blend (userCF 25%, CF 20%, content 20%, context 20%, category-popularity 15%); single user → 3-way (CF 40/content 30/context 30). Homeino's engine should degrade the same way as interaction volume grows: today content/context dominate, later blend in collaborative terms — with weights as named constants, not magic numbers.
- **Per-item score breakdown** — `scoreBreakdown` map returned per recommendation (factor→score). Homeino already does this (`RecommendationItem.breakdown`) — keep it; it makes the "reasonText" honest and debuggable.
- What NOT to copy: recommendations are computed synchronously from client-held behavior blobs (no DB events table), and the Gemini explanation call sits in the hot path — Homeino's persisted-recommendations + `reasonCode` approach is better.

**Verdict: ADAPT** — port the engagement-score formula, the two-tier weight sets, and keep breakdowns; ignore the Medusa/Unsplash/Gemini-explanation plumbing.

## 6. gorse-io/gorse (Go recommender system) — deep dive

Facts: **Apache-2.0** (`LICENSE`; verified identical at tags v0.3.0–v0.5.0 and master, so no AGPL exposure for current releases) · 9,817 stars · last commit 2026-08-28 (active: SIMD work in `common/floats`) · Go, single binary per node. **Commercial use is permitted**: Apache-2.0 grants use/modification/distribution + patent grant, no copyleft on your app or your data, no SaaS network clause. Running it as a separate service triggers no obligations beyond preserving LICENSE/NOTICE. (The AGPL worry in the task brief does not apply — Gorse is not AGPL. Only if pinning a pre-2021 pre-release would licensing need re-checking.)

- **Self-hosting weight** — `docker-compose.yml`: 3 node types (master :8086 RPC + dashboard :8088, server :8087 REST, worker :8089) + its own data store (MySQL default; Postgres supported — `storage/data/sql.go`) + optional Redis cache + optional vector store (Qdrant/Milvus/Weaviate, `storage/vectors/`) + blob store. There is a single-container escape hatch (`cmd/gorse-in-one`, README Quick Start `docker run -p 8088:8088 zhenghaoz/gorse-in-one`), but it still runs its **own DB schema** — Homeino's Supabase stays a second, synchronized copy of items/feedback, i.e. two sources of truth for the catalog.
- **REST API surface** (`server/rest.go:238-616`): users/items/feedback CRUD (incl. bulk via master `/api/bulk/*`, `master/rest.go:276-278`), `GET /api/recommend/{user-id}[/{category}]`, `GET /api/item-to-item/{name}/{item-id}`, `GET /api/latest`, `GET /api/non-personalized/{name}`, `GET /api/item/{id}/neighbors`, `POST /api/session/recommend` (anonymous session recs), `POST /api/chat/completions` (LLM chat, `logics/chat.go`), typed feedback. Node SDK would be thin — but it's still an extra network hop + sync job per catalog write.
- **Quality vs Homeino's engine**: Gorse gives real CF (matrix factorization, `model/cf`), item-to-item (embedding/tags/users types, `logics/item_to_item.go`), CTR/FM ranker (`model/ctr/fm.go`), LLM reranker (`config.toml [recommend.ranker] type="llm"` + `[recommend.ranker.reranker_api]`), external recommender scripts, dashboard/pipeline editor. But CF needs *volume*: with an early-stage marketplace's sparse interaction table, matrix-factorization quality ≈ popularity; Homeino's content/style/context blend (`ranking.ts`) + pgvector embeddings (`productMatching.buildCatalogEmbeddings`) is the higher-signal path at this size, and its honest `not_enough_data` state (recommendationEngine.ts header) avoids Gorse-style popularity fallbacks until real evidence exists.
- **Ops verdict inputs**: data volume small, ops budget minimal, Supabase must remain the single source of truth, "no self-managed Docker in prod" posture ⇒ running master+server+worker (+DB sync worker) is a permanent ops liability with no measurable quality gain today.

**Verdict: REJECT as a service at current scale.** Re-evaluate only when: (a) interaction events outgrow Postgres-friendly CF approximations, (b) someone can own 3 containers + a sync ETL, and (c) A/B shows in-Postgres CF/ANN is the bottleneck. Meanwhile **REFERENCE** its pipeline design: candidate-generators → ranker → fallback chain (`config.toml [recommend] recommenders=[...], [recommend.fallback] recommenders=["item-to-item/neighbors","latest"]`), named non-personalized leaderboards with SQL-ish score functions (`[[recommend.non-personalized]] score="count(feedback, .FeedbackType == 'star')"` + time filter), `cache_expire` for inactive users, and LLM-reranker-as-final-stage (query/document templates) — all implementable inside `recommendationEngine.ts`/`ranking.ts` without new infrastructure.

## Concrete copy-list for Homeino (priority order)

1. `ranking.ts`: Bayesian rating smoothing for `popularity`/review factors (VIVPM); signed engagement formula over interaction events for `behaviorSimilarity`/`recentInterest` (Max-Eee `recommendation-engine.ts:6-66`).
2. `recommendationEngine.ts`: two-tier weight constants (cold-start vs multi-user blend) + fallback chain "item-to-item → latest" semantics (Max-Eee; Gorse `[recommend.fallback]`).
3. Orchestrator text-to-SQL tool (future): read-only transaction + statement timeout + refusal of unsupported filters (VIVPM `db/database.py:38-55`, `sql.py`).
4. `nlu.ts`/`orchestrator.ts`: history-bound follow-up rewrite incl. "carry forward previous result constraints", Persian-aware (VIVPM `memory.py`).
5. Wishlist: saved-price/target-price live-join alerts, no scheduler (VIVPM `/api/saved`; `wishlist_items` + read-path join).
6. `customerMemory.ts`: correction-into-memory on recommendation feedback (PAHF `shopping_agent.py:161-247`); clarify-before-recommend when profile is underdetermined (PAHF prompts).
7. Eval: fixture-based routing/faithfulness suite in vitest modeled on VIVPM's rubric harness.
8. Never do: non-atomic agent-side stock writes (Pukar77); popularity-fallback recommendations without evidence (Gorse at low volume); a second catalog store (Gorse).

*All file references are to the cloned repos at `/tmp/audit-3c/` unless prefixed with `src/` (Homeino).*
