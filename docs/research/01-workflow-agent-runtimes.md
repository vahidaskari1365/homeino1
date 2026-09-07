# Research 01 — AI Workflow / Agent Runtimes Audit (Group 15-3a)

**Date:** 2026-09-07 · **Method:** primary sources only — `git clone --depth 1` of each repo (README, LICENSE, pyproject/package.json, docker-compose, docs) + GitHub HTML for star counts. All file citations below refer to the cloned snapshots at commit shown per repo.
**Homeino context:** single Next.js 16 App Router codebase (React 19, TS, Supabase/Drizzle, vitest), **no self-managed Docker in production**, in-repo agent orchestrator already exists (agents/tools/permissions/workflows/runs/approvals). UI locked. Preference: zero new runtime deps unless value is exceptional.

---

## 1. Dify (langgenius/dify) — @ d91672c6, 2026-09-07

| Fact | Value |
|---|---|
| Stars / last push | 154,675 ★ / 2026-09-07 (very active) |
| License | **Apache-2.0, modified** (dify/LICENSE): commercial OK, **except** (a) multi-tenant/workspace operation requires paid license, (b) frontend logo/copyright must not be removed. Backend-only single-tenant use is permitted. |
| Architecture | Python LLM app **platform**: Flask API + Celery workers, web console, plugin daemon, sandbox, nginx |
| Self-hosting | Docker Compose only; core services: api, api_websocket, worker, worker_beat, web, db_postgres, redis, sandbox, plugin_daemon, agent_backend, ssrf_proxy ×2, nginx + ~15 optional vector-DB containers (weaviate, qdrant, milvus, elasticsearch…). Min 2 CPU / 4 GiB (dify/README.md L67). |
| API / SDK | Per-app REST "Service API"; official clients: nodejs-client, php-client (dify/sdks/) |
| Agent runtime / workflow / tools | Built-in (visual) workflow engine, agent node (new `langgenius/dify-agent-backend:1.17.0` service), plugin/tool marketplace, model-provider abstraction |
| Production readiness / security | High (huge install base), SSRF proxy sandbox, moderation hooks — but it **is** the whole platform, not a library |

**Verdict: REJECT** (as dependency). Cannot be embedded in Next.js; requires the full multi-container Docker stack Homeino explicitly avoids; overlaps Homeino's existing orchestrator; multi-tenant license clause is a long-term trap.
**Homeino integration:** none — steal patterns only (workflow DSL shape, per-app scoped Service API, model-provider registry).

## 2. Langflow (langflow-ai/langflow) — @ e3abffc, 2026-09-01

| Fact | Value |
|---|---|
| Stars / last push | 154,359 ★ / 2026-09-01 (very active) |
| License | **MIT** (langflow/LICENSE) — commercial use OK, no strings |
| Architecture | Python visual flow platform: FastAPI backend + React builder; every flow auto-exposes REST API + MCP server |
| Self-hosting | Lightest of the platforms: docker_example = **2 containers** (langflow + postgres); SQLite fallback, single port. Also `lfx` (src/lfx, v1.12.0): stateless CLI/runtime serving flow JSON as FastAPI endpoints `/flows/{flow_id}/run` with **no DB** (src/lfx/README.md) |
| API / SDK | REST per flow, MCP server, Python/TS SDKs (src/sdk), BUNDLE_API.md for export |
| Agent runtime / workflow / tools | Graph-based flows, multi-agent orchestration, 51-dep lfx runtime (vs 100s for full platform) |
| Production readiness / security | Active, enterprise features; heavy Python dep tree for full install |

**Verdict: ADAPT** — the only candidate worth a future adapter: author flows visually (or as JSON files), expose them over plain HTTP/MCP, call from a thin Next.js route handler. Keep it **optional** (sidecar), default = in-repo orchestrator.
**Homeino integration:** if/when non-engineers need to edit AI pipelines, run `lfx serve` (stateless, no DB) behind one internal route; adapter = flow-JSON-to-HTTP client (~50 LOC).

## 3. Flowise (FlowiseAI/Flowise) — @ 9291856, 2026-08-13

| Fact | Value |
|---|---|
| Stars / last push | 55,428 ★ / 2026-08-13 — **README banner: "Flowise has been archived" → discussion #6727** |
| License | Apache-2.0, **except** `packages/server/src/enterprise` + IdentityManager = commercial license (flowise/LICENSE.md) |
| Architecture | TS/Node visual agent builder: packages server (92 deps), ui, agentflow, components |
| Self-hosting | Node ≥ 20, `npm i -g flowise`, port 3000, SQLite default; Docker optional (flowise/README.md) |
| API / SDK | REST API per flow/agentflow; TS-native (closest fit of the group) |
| Production readiness | Frozen upstream — no maintainer roadmap |

**Verdict: REJECT.** Archived upstream, 92-dependency server, visual platform duplicating Homeino's existing orchestrator; enterprise features behind commercial license.
**Homeino integration:** none.

## 4. crewAI (crewAIInc/crewAI) — @ 143e902, 2026-09-04

| Fact | Value |
|---|---|
| Stars / last push | 58,176 ★ / 2026-09-04 (active) |
| License | **MIT** (crewai/LICENSE) |
| Architecture | Pure Python **framework** (not platform): Crews (role-playing agents) + event-driven Flows (`@listen`/`@router`); lib/crewai v1.15.20 |
| Self-hosting | No server at all — it's a library; requires Python ≥ 3.10,<3.14; 31 deps incl. chromadb, lancedb, tokenizers, pdfplumber, mcp, cel-python (crewai/lib/crewai/pyproject.toml) |
| API / SDK | None HTTP in OSS — `crewai run` CLI; deploy/monitoring = proprietary CrewAI Cloud/Enterprise |
| Production readiness | Mature lib; ops burden lands on you (own worker + HTTP wrapper) |

**Verdict: ADAPT (low priority).** Best pure-framework fit for batch content jobs (e.g., Persian product-description/SEO crews), but needs a Python sidecar process behind HTTP — a second runtime Homeino doesn't want by default.
**Homeino integration:** only if multi-agent content pipelines become a requirement: containerize one `crewai` FastAPI worker, adapter = HTTP client + job rows in Supabase.

## 5. AutoGen (microsoft/autogen) — @ 027ecf0, 2026-04-06

| Fact | Value |
|---|---|
| Stars / last push | 60,844 ★ / 2026-04-06 (stale ≈5 months) |
| License | Repo root: **CC-BY-4.0**; code packages carry separate `LICENSE-CODE` = **MIT (Microsoft)** (autogen/python/packages/autogen-core/LICENSE-CODE) |
| **Maintenance mode — VERIFIED from repo itself** | README badge `status-maintenance mode` → microsoft/agent-framework; "⚠️ Maintenance Mode … will not receive new features or enhancements and is community managed"; new users → **Microsoft Agent Framework (MAF)**, migration guide provided (autogen/README.md L14–25) |
| Architecture | Python multi-agent framework: autogen-core 0.7.5 (light, 6 deps), autogen-agentchat, autogen-ext |
| Self-hosting | Library; AutoGen Studio = separate FastAPI UI service needing Postgres (psycopg, alembic) |
| Production readiness | Frozen; future = MAF (out of this audit group's scope) |

**Verdict: REJECT.** Maintenance mode confirmed from the repo; adopting a framework whose successor already shipped 1.0 is negative value.
**Homeino integration:** none. Re-evaluate only if MAF is added to scope later.

## 6. OpenHands (OpenHands/OpenHands) — @ f7fb0c4, 2026-09-05

| Fact | Value |
|---|---|
| Stars / last push | 86,395 ★ / 2026-09-05 (active, **beta** badge) |
| License | **MIT** (both OpenHands and software-agent-sdk) |
| Architecture — repo pivot | README now = "**Agent Canvas**": self-hosted control center (TS, `@openhands/agent-canvas` 1.16.0, 50 deps) for running coding agents (OpenHands, Claude Code, Codex, Gemini, any **ACP**-compatible) across local/remote/cloud backends |
| **Agent SDK** | Separate repo OpenHands/software-agent-sdk (MIT): Python + TypeScript + REST APIs for **coding** agents — openhands-sdk (Agent/LLM/Conversation/Tool), openhands-agent-server (REST), openhands-tools (terminal, file_editor, task_tracker) |
| **Approval / sandboxing model** | `sdk/security/confirmation_policy.py`: `ConfirmationPolicyBase.should_confirm(risk)` with `SecurityRisk` levels + AlwaysConfirm/NeverConfirm/LLM-boolean policies; `toolshield_llm_analyzer.py` for tool risk analysis; workspaces = local or **ephemeral Docker/K8s via Agent Server** (README: "agents can either use the local machine … or run inside ephemeral workspaces (e.g. in Docker or Kubernetes)") |
| Self-hosting | `npx @openhands/agent-canvas --public` + `LOCAL_BACKEND_API_KEY`: static :3001 + agent server :18000 + automation :18001 behind ingress :8000; docker sandbox mode recommended for agent execution (docs/SELF_HOSTING.md, docs/architecture.md) |

**Verdict: REFERENCE.** Coding-agent domain ≠ Homeino's customer-facing marketplace AI; but its security model is the best pattern in this group for Homeino's approvals system.
**Homeino integration:** none as code — copy the `ConfirmationPolicy(risk)` + risk-graded tool gating shape into Homeino's existing permission/approval tables.

---

## Comparison Summary

| Repo | Stars | Push | License | Self-host weight | Next.js integration path | Verdict |
|---|---|---|---|---|---|---|
| Dify | 154,675 | 2026-09-07 | Apache-2.0 modified | 15+ containers, Docker mandatory | HTTP only | REJECT |
| Langflow | 154,359 | 2026-09-01 | MIT | 2 containers, or stateless `lfx` | HTTP/MCP per flow | **ADAPT** |
| Flowise | 55,428 | 2026-08-13 | Apache-2.0 + commercial bits | Node app (archived) | HTTP | REJECT |
| crewAI | 58,176 | 2026-09-04 | MIT | Python lib, no server | Needs Python sidecar | ADAPT (low) |
| AutoGen | 60,844 | 2026-04-06 | CC-BY-4.0 / MIT (code) | lib + Studio (Postgres) | none sensible | REJECT |
| OpenHands | 86,395 | 2026-09-05 | MIT | TS canvas + agent server | ACP/REST (wrong domain) | REFERENCE |

**Which ONE runtime deserves an adapter? → Langflow, and only conditionally.**
Rationale: MIT license; smallest self-host footprint (2 containers, or zero-DB `lfx`); contract that fits Homeino's "swappable adapter" rule perfectly — a flow is JSON, invocation is plain HTTP (`/flows/{id}/run`) or MCP, no SDK coupling, no DB requirement with `lfx serve`. It complements (does not replace) the in-repo orchestrator: Homeino keeps runs/approvals/permissions in-repo and would only delegate execution of *visually authored graphs* to Langflow. Trigger to build the adapter: a non-developer role needs to edit AI pipelines; until then, build nothing.
AutoGen is dead-ended (MAF successor), Flowise is archived, Dify and Flowise are platforms-as-entire-products that violate the no-Docker/no-new-runtime constraint, crewAI only pays off with a second Python runtime, and OpenHands solves a different problem (coding agents) — though its `ConfirmationPolicy`/`SecurityRisk` design should be mirrored in Homeino's approval logic.

### Sources
- Clones (2026-09-07, `--depth 1`): /tmp/audit-3a/{dify@d91672c6, langflow@e3abffc, flowise@9291856, crewai@143e902, autogen@027ecf0, openhands@f7fb0c4, oh-sdk@main}
- Key files cited: dify/LICENSE, dify/README.md, dify/docker/docker-compose.yaml, dify/sdks/ · langflow/LICENSE, langflow/pyproject.toml, langflow/src/lfx/README.md, langflow/docker_example/docker-compose.yml · flowise/README.md (archive banner), flowise/LICENSE.md, flowise/packages/server/package.json · crewai/LICENSE, crewai/lib/crewai/pyproject.toml · autogen/README.md, autogen/LICENSE, autogen/python/packages/autogen-core/pyproject.toml, autogen/python/packages/autogen-core/LICENSE-CODE, autogen/python/packages/autogen-studio/pyproject.toml · openhands/README.md, openhands/docs/{SELF_HOSTING,architecture}.md, openhands/package.json · oh-sdk/README.md, oh-sdk/openhands-sdk/openhands/sdk/security/confirmation_policy.py, oh-sdk/LICENSE
- Star counts scraped from github.com repo pages (HTML `stargazerCount`), 2026-09-07; GitHub REST API was rate-limited.
