# Research 04 — AI Gateways & Free-API Landscape (Group 15-3d)

**Date:** 2026-09-07 · **Method:** primary sources only — raw LICENSE/README files fetched from `raw.githubusercontent.com` (snapshots 2026-09-07), commit dates via `github.com/<repo>/commits.atom`, star counts + license tags scraped from GitHub HTML (`stargazerCount`), litellm license history via commit `.patch`. Free-tier numbers below are **as stated by the lists themselves** (each list cites its own verification date); where lists conflict, both figures are shown.
**Homeino context:** single Next.js 16 App Router codebase, **no sidecar services in production**. In-repo gateway already exists: `src/services/ai/` — provider adapters (`openaiChatProvider.ts`, `geminiProvider.ts`, `zaiProvider.ts`, `pollinationsProvider.ts`, `freellmapi.ts`), env-based OpenAI-compatible client (`llm/openaiCompatLlm.ts`: `LLM_API_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`), `engineConfig.ts` fallback flavor detection, credits/cost layer (`credits.ts`, `serverCredits.ts`).

---

## 1. BerriAI/litellm — 58,180 ★ / last commit 2026-09-06

| Fact | Value |
|---|---|
| License | **MIT core + separate enterprise carve-out** (LICENSE fetched 2026-09-07): "All content … under the `enterprise/` directory … is licensed under the license defined in `enterprise/LICENSE`. Content outside … is available under the MIT license." NOT a repo-wide ELv2 switch. Change commit: `a9e79c8` — *"refactor: creating enterprise folder"* (Krrish Dholakia, **2024-02-15**); previous LICENSE commit 2023-07-27 (plain-MIT era). `enterprise/LICENSE` is not public (404) — enterprise code ships separately. |
| Enterprise gate (docs.litellm.ai/docs/enterprise) | SSO/SCIM, audit logs, most built-in guardrails (llamaguard, lakera, aporia…), multi-region, per-project budgets require `LITELM_LICENSE`. OSS keeps proxy, virtual keys, budgets, Presidio PII masking. |
| Self-hosting | Python **proxy server** (pip or Docker) + Redis & Postgres for production scale. The SDK is **Python-only** — there is no JS/TS library, so a Next.js app cannot use it in-process; it must run as a **sidecar HTTP service**. |
| Value vs Homeino | Provider swap (100+ providers, incl. Bedrock/Azure signing), budgets, spend tracking. Homeino's `openaiChatProvider.ts` / `llm/openaiCompatLlm.ts` already swap any OpenAI-compatible provider via env vars with zero code change; `engineConfig.ts` already handles flavor/fallback. |

**Verdict: ADAPT (pattern only) / REJECT as a runtime dependency.** Core is still MIT (confirmed, changed only by the 2024-02-15 enterprise/ carve-out), but it demands a Python sidecar Homeino deliberately avoids. The one thing we'd want from it — env-based provider swap + fallback — is already implemented in-repo.

## 2. xxy2026/freellmapi — 0 ★ / last commit 2026-06-21 (stale mirror)

| Fact | Value |
|---|---|
| What it is | **Mirror/fork of `tashfeenahmed/freellmapi`** (24,648 ★ / commit 2026-09-06): every badge, install script and Docker path in the README points upstream. Self-hosted Node 20+ (Express + React dashboard + SQLite), MIT. |
| Endpoint compatibility | `POST /v1/chat/completions`, `GET /v1/models`, `POST /v1/responses` (Codex shim), `/v1/embeddings` (family-locked failover), streaming, tool calling, vision **input** via `image_url`. **Explicitly NOT supported: `/v1/images/*`, `/v1/audio/*`, `/v1/completions`, `/v1/moderations`.** |
| Providers / routing | 16–17 free providers behind one endpoint (Google, Groq, Cerebras, NVIDIA, Mistral, OpenRouter, GitHub Models, Cohere, Cloudflare, HuggingFace, Z.ai, Ollama Cloud, Kilo, Pollinations, LLM7, OVH, OpenCode Zen). Router: 429/5xx/timeout → key cooldown → next in fallback chain (≤20 attempts); per-key RPM/RPD/TPM/TPD ledger; sticky sessions; AES-256-GCM key storage; unified bearer key; admin UI + analytics. |
| Rate-limit reality (its own "Limitations") | No frontier models; "intelligence degrades as the day progresses" (top models exhaust daily caps, resets UTC midnight); no SLA; "free tiers can change without notice"; single-user, local-first — don't expose publicly. |
| ToS review (May 2026, in README) | Groq/Cerebras/Mistral/OpenRouter/Ollama Cloud/OVH ✅ · Gemini ⚠️ (Mar 2026 clause) · Cloudflare ⚠️ ambiguous · NVIDIA ⚠️ "evaluation only" (40 RPM) · GitHub Models ⚠️ "experimentation" · Cohere ❌ avoid · Z.ai ⚠️ anti-traffic-redirect clause. |
| vs Homeino `freellmapi.ts` | Matches: `GET /v1/models` + `POST /v1/chat/completions` with `model:"auto"` + GLM id discovery (GLM-4.5/4.7 Flash are real catalog models). **Mismatch: `POST /v1/images/generations` does not exist** in FreeLLMAPI — our `generateDesign`/`editImage` paths will 404 and degrade to mock (already coded). `inpaint` uses the supported vision-chat path but the `modalities` field is non-standard and image *output* is not promised. |

**Verdict: REFERENCE** (the upstream project, not this 0-star stale fork). Chat compatibility confirms our adapter; image generation must keep flowing through `pollinationsProvider` / paid endpoints — never through FreeLLMAPI.

## 3. ReallyArtificial/freeport — 2 ★ / last commit 2026-06-20

| Fact | Value |
|---|---|
| License | **MIT** (README + GitHub license tag). |
| Runtime | Node.js + TypeScript + **Fastify v5**, SQLite (better-sqlite3), single process/container, `npx @reallyartificial/freeport` on :4000, admin UI at `/ui/`. The least-invasive gateway architecture for a Node shop. |
| Features | OpenAI **and** Anthropic ingress (`/v1/chat/completions`, `/v1/messages`); OpenAI/Anthropic/Gemini native + any OpenAI-compatible backend; fallback chains + circuit breaker; **semantic cache** (local all-MiniLM-L6-v2 embeddings, similarity threshold); **budget caps** per project with kill switch; **PII redaction** (SSN/cards/emails/phones) + content filter, pluggable guardrails; **audit logs** with retention; **AES-256-GCM encrypted keys**; token-bucket rate limits; prompt A/B; Prometheus metrics; round-robin key pools. |
| vs litellm (honest) | Same core value (route/fallback/budget) with a 1-process Node footprint instead of Python+Redis+Postgres — but ~29,000× less adoption (2★ vs 58k★), far smaller provider matrix (no Bedrock/Azure-class integrations), smaller community, and it is still a **separate service**. |

**Verdict: ADAPT (ideas, not dependency).** Homeino should deploy **neither** gateway today: `src/services/ai` already implements env-based swap, fallback chain and credits/cost caps in-process. If a dedicated gateway ever becomes necessary (multi-app budgeting, audit logs), freeport is the only one compatible with Homeino's "single Node process" constraint — litellm at that scale, never in between. Ideas worth porting in-repo first: semantic cache + PII redaction hook before `openaiChatProvider`.

## 4. build996/awesome-free-ai-apis — 2 ★ / last commit 2026-08-31 · MIT

"Free AI API Limits" — the only list that **measures** instead of copying docs (own harness `free-ai-api-benchmark`, US GitHub Actions runner, reads live `x-ratelimit-*` headers). August 2026 findings: Groq `gpt-oss-120b` ≈ 525 tok/s; **GitHub Models dead (`410`, retired 2026-07-30)**; Cerebras/SambaNova/DeepSeek/Together/xAI now **require card/deposit**; Gemini limits login-gated/unpublished; OpenRouter ≈ 20 req/min, ≈ 50/day free (one-time $10 credit → ≈ 1,000/day); Cloudflare 10,000 Neurons/day, hard-stops instead of billing; Mistral free-tier limits "went dark". Image: Cloudflare ≈ 230 FLUX images/day, Pollinations keyless. Own warning: *"Free tiers change constantly … always confirm against the linked source."* — **Verdict: REFERENCE** (freshest honest snapshot).

## 5. SimonLee99999/awesome-free-ai-apis — 0 ★ / last commit 2026-05-30 · CC0-1.0

Short categorized list (LLM/image/speech/embeddings/vectordb/local). Claims: Gemini 1,500 req/day; Groq ~300 tok/s OpenAI-compatible; Cerebras "No CC required" (**conflicts** with build996 + paco — stale); expiring-credits section. No commercial-use column, no verification dates per row. — **Verdict: REFERENCE** (thin, partially stale).

## 6. pacocartones/free-llm-api-hub — 42 ★ / last commit 2026-09-02 · MIT

Maintained **open dataset** (69 providers in `data/providers.json` + JSON schema, CI-validated, freshness badge on a 90-day re-verification SLA, every row dated + sourced to the provider's own docs, ⚠️ labels for unconfirmed items). Machine-usable collections: no-card (59), **commercial-use (25)**, OpenAI-compatible (35), always-free (6). Editorial facts relevant to us: Cloudflare Workers AI = "safe to ship commercially"; **Cohere & NVIDIA = eval-only**; GitHub Models fully retired 2026-07-30; Cerebras now card-gated $5/30-day trial; Gemini commercial OK but free-tier prompts may be used by Google for product improvement (outside UK/CH/EEA/EU), and since 2026-03-23 only *Paid* Services may serve EEA/CH/UK end-user API clients; OpenRouter ToS (Jul 2026) bans resale; Z.ai = permanently-free $0 models; Ollama Cloud free plan commercial OK. Own warning: *"Free-tier terms change without notice."* — **Verdict: REFERENCE** (best structured dataset + explicit commercial-use flags).

## 7. amardeeplakshkar/awesome-free-llm-apis — 158 ★ / last commit 2026-08-16 · CC0-1.0

Best per-provider **limit tables** ("last verified **March 2026**"): Gemini 15 RPM / 1,500 RPD (Flash), 2/50 (Pro) · Mistral 1 req/s, 1B tok/mo · Cohere 20 RPM / 1,000 req/mo (partial compat) · Zhipu GLM-4.7-Flash limits undocumented · Groq 30 RPM / 14,400 RPD / 6,000 TPM · Cerebras 30 RPM / 14,400 RPD · OpenRouter 20 RPM / 200 RPD · GitHub Models 10–15 RPM / 50–150 RPD (**stale — retired**) · NVIDIA 40 RPM credit-based · HF ≈ $0.10/mo credits · Cloudflare 10k neurons/day (partial compat) · LLM7 15→30 RPM · Pollinations per-IP hourly, anon OK · UnoRouter ~1 RPM/model. Excludes trial credits; notes "rate limits change frequently". — **Verdict: REFERENCE** (good tables, 6-month staleness in places).

## 8. freellms/free-openai-compatible-api — 1 ★ / last commit 2026-08-10 · MIT

Marketing directory for freellms.org ("updated daily"). Base-URL cheat-sheet with limits: Groq 30 RPM / 14,400 RPD · Gemini 15 RPM / 1,500 RPD · Cohere 20 RPM · OpenRouter 1K RPD · Cloudflare 10k neurons/day · Cerebras 5 RPM · LLM7 30 RPM · SambaNova 20 RPM. **Still lists GitHub Models as free (stale).** No commercial-use analysis, no methodology. — **Verdict: REFERENCE** (base-URL lookup only).

---

## Gateway decision for Homeino

**Deploy no gateway.** litellm = Python sidecar (no JS SDK) — REJECT as runtime; freeport = Node single-process but duplicates in-repo `src/services/ai` (fallback chain, credits, cost caps) — port its semantic-cache/PII-guardrail *ideas* instead; freellmapi = second service + no image endpoint. The existing env-based OpenAI-compatible adapter + provider chain covers the same value with zero new infrastructure.

## Recommended free-provider fallback chain (chat/intent, server-side, in-repo adapters)

| # | Provider (adapter) | Free tier per lists (with source date) | OpenAI-compat | Commercial use |
|---|---|---|---|---|
| 1 | **Z.ai GLM-4.7 Flash** (`zaiProvider`/`engineConfig` zai-public) | $0 models permanent (paco 2026-08-02); limits undocumented (amardee 2026-03) | ✅ `api.z.ai/api/paas/v4` | ⚠️ anti-traffic-redirect clause (freellmapi ToS 2026-05); OK as first-party product feature |
| 2 | **Google Gemini 2.5 Flash** (`geminiProvider`) | ~15 RPM / 1,500 RPD (amardee 2026-03) — now unpublished/login-gated (build996 2026-08) | ✅ `/v1beta/openai/` | ✅ commercial OK (paco 2026-08-02); free-tier data may train Google models (ex-EU/UK/CH) |
| 3 | **Groq** (`openaiChatProvider` env) | 30 RPM / 14,400 RPD / 6,000 TPM (amardee + freellms) | ✅ `api.groq.com/openai/v1` | ✅ commercial OK; phone verification required; Llama-family Persian quality weaker → use for JSON/intent |
| 4 | **Cloudflare Workers AI** (`openaiChatProvider` env) | 10,000 Neurons/day, hard-stop, no card (all lists; paco 2026-08-02) | ✅ (amardee says partial) | ✅ "safe to ship commercially" (paco); some models need Workers Paid |
| 5 | **OpenRouter `:free`** (`openaiChatProvider` env) | 20 RPM; 50–200 RPD (build996 vs amardee conflict); ~1,000/day after one-time $10 credit | ✅ | ✅ first-party OK; resale banned (ToS Jul 2026) |
| — | Pollinations (keyless) stays the **image-gen** fallback — gateways serve no images. | per-IP hourly, anon (amardee) | ✅ | not explicitly guaranteed (paco) |

**Avoid:** Cohere (eval-only ToS) · NVIDIA NIM (eval-only, 40 RPM) · **GitHub Models (retired 2026-07-30)** · Cerebras (card required since 2026) · HuggingFace serverless (≈$0.10/mo credit, cold starts) · Mistral free (limits hidden behind login).
**Standing caveat (all 4 lists):** free tiers change constantly — build996 and paco build re-verification into their workflow; re-check this table every quarter.

## Sources

Repos & files (fetched 2026-09-07): `raw.githubusercontent.com/BerriAI/litellm/main/LICENSE` · `litellm` commit `a9e79c8` patch (2024-02-15) · `docs.litellm.ai/docs/enterprise` · `xxy2026/freellmapi` + upstream `tashfeenahmed/freellmapi` README/LICENSE · `ReallyArtificial/freeport` README · READMEs of `build996/awesome-free-ai-apis`, `SimonLee99999/awesome-free-ai-apis`, `pacocartones/free-llm-api-hub`, `amardeeplakshkar/awesome-free-llm-apis`, `freellms/free-openai-compatible-api`. In-repo: `src/services/ai/{freellmapi.ts,openaiChatProvider.ts,pollinationsProvider.ts,engineConfig.ts}`, `src/services/ai/llm/openaiCompatLlm.ts`.
