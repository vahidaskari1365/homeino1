# Homeino AI — Engine Accuracy & Performance Upgrade (Phases 1–23)

> Scope of this upgrade: **AI engine only**. Zero UI/UX/Layout changes.
> Every change lives in `src/services/ai/**`, `src/app/api/ai/**`, docs,
> config, and tests. The visual appearance of Homeino is untouched.

---

## Phase 1 — AI Audit (before any change)

### Current flow

```
UI (AI Designer /ai/design + AIPanel chat)
   │  aiService (src/services/ai/index.ts) — client-safe facade
   ▼
POST /api/ai   (validation · rate limit · sanitization)
   ├─ "understand" ─► LLM Service (llm/) — openaiCompatLlm | heuristicLlm
   ├─ "pipeline"   ─► Design Pipeline (pipeline.ts) → { LLM, Orali, base provider }
   └─ generate/edit/inpaint/chat/suggest/analyze/recommend
                     └─► resolveProvider() → gemini | freellmapi | mock
```

### Answers to the 10 audit questions

1. **Current flow** — see diagram. The designer page mostly calls
   `generate` directly; the full `pipeline` (understand → plan → generate →
   validate) exists server-side and is the sanctioned path for scoped edits.
2. **Input** — raw Persian prompt + style + room + optional reference image /
   mask / product pick. No structured context was built before model calls.
3. **Context to the LLM** — system prompt + a small JSON of
   `{prompt, style, room, colors, changeScope, selectedTargets}` (≤220 tokens
   out). Compact, but no room/object/previous-state context.
4. **Context to the Image/Visual AI** — a composed English instruction
   (targets + preservation rules) for Orali; providers Gemini/FreeLLMAPI get
   a short prompt with no preservation rules.
5. **Output processing** — LLM JSON is normalized against the element
   vocabulary (never trusted blindly); image output is validated
   (before===after → honest `preview`). No schema validation with retry.
6. **Overlay** — Orali returns `OverlayRegion` boxes; when no real engine
   ran, regions stay empty (honest). UI never fakes boxes.
7. **Mock parts** — `mockAiProvider` (generate/edit/inpaint/chat/suggest/
   analyze/recommend) and `heuristicLlm` (intent understanding) when no keys
   are configured. Results are labeled preview honestly.
8. **Real provider calls** — `openaiCompatLlm` (any OpenAI-compatible
   endpoint), `oraliClient`, `geminiProvider`, `freellmapiProvider` — all
   env-gated, server-only.
9. **Token waste** — product info was never sent (good), but: no bounded
   retry (a bad JSON answer wasted the call and silently fell back), no
   compact context slicing, and the legacy `lib/server/ai` orchestrator +
   `aiService` DB persistence were dead code (duplicated intent shapes).
10. **Accuracy risks** — (a) «رنگ مبل را کرم کن» was read as a full
    restyle of the sofa instead of a color change; (b) scope was binary
    (targeted/full) — no area/whole-home distinction; (c) no design memory
    («کمی روشن‌ترش کن» had no previous target); (d) Gemini/FreeLLMAPI
    prompts contained no preservation rules; (e) no product-aware placement
    (random grid coordinates); (f) errors were raw strings (500 «خطای سرور»)
    with no standardized codes; (g) duplicate clicks could double-run
    generations; (h) no per-request telemetry.

---

## What changed (by phase)

| Phase | Change | Files |
|---|---|---|
| 2 | **AI Context Engine** — structured `AIContext` (room, objects, intent, style, products, budget, previousState) built before every model call; compact serialization ≤700 chars | `src/services/ai/context.ts` (new) |
| 3 | **Room Understanding** — `RoomObject` / `RoomUnderstanding` / `RoomArchitecture` types + honest empty default; plugs into context | `src/services/ai/roomState.ts` |
| 4 | **Change Scope** — `single_item \| area \| room \| whole_home` with conservative detection, strength mapping, summary | `src/services/ai/scope.ts` (new) |
| 5 | **Protected Elements** — `resolveProtectedElements()`: structural defaults (wall/floor/ceiling/door/window) + untouched objects; whole-home = explicit only | `roomState.ts`, `scope.ts` |
| 6 | **Structured Intent** — LLM contract extended with `scope` + `protectedElements`; schema validation with bounded retry | `llm/types.ts`, `llm/openaiCompatLlm.ts` |
| 7 | **Product-aware overlay** — real product facts (name/category/material/color/style/dimensions) compiled into the engine instruction | `src/services/ai/placement.ts` (new) |
| 8 | **Product placement** — deterministic `targetRegion` planner (category-based layout hints, collision avoidance, aspect-aware scale); no random guessing | `placement.ts` |
| 9 | **Image editing** — targeted scopes use edit/inpaint paths (mask honored); `editMode` decided by scope; full-room only for room/whole-home | `pipeline.ts` |
| 10 | **LLM = reasoning only** — LLM never renders; it produces intent/scope/plan JSON; the image engine does pixels | unchanged (contract) |
| 11 | **Provider abstraction** — unchanged resolver chain (`resolveProvider`, `resolveLlm`, `resolveOrali`); env-only swaps | (existing) |
| 12 | **Token efficiency** — compact context slice; product lists filtered by target categories; previous state truncated; bounded retry instead of wasted calls | `context.ts` |
| 13 | **Response validation** — `validateIntentPayload` schema checks + `withBoundedRetry` (max 3, corrective hint fed back; infinite retry forbidden) | `src/services/ai/validation.ts` (new) |
| 14 | **Conservative default** — «when uncertain, preserve more and change less»: empty/unknown requests stay `single_item`; «همه چیز» alone ≠ whole home; invalid LLM output degrades to heuristic | `scope.ts`, `heuristicLlm.ts` |
| 15 | **Design memory** — `previousTargets`/`previousChanges` in the request; continuation «کمی کوچک‌ترش کن» re-targets the previous sofa | `llm/*`, `context.ts` |
| 16 | **AI history/debug data** — generation rows already existed (`aiGenerations`); telemetry now records every request (id, action, provider, duration, tokens, credits, status) | `src/services/ai/telemetry.ts` (new) |
| 17 | **Server-side credits** — reserve → run → finalize/refund gate, opt-in `AI_SERVER_CREDITS=1` (idempotent refunds; INSUFFICIENT_CREDITS aborts before AI work) | `src/services/ai/serverCredits.ts` (new) |
| 18 | **Standardized errors** — `AiErrorCode`: PROVIDER_ERROR / TIMEOUT / RATE_LIMIT / INVALID_REQUEST / INSUFFICIENT_CREDITS / INVALID_AI_OUTPUT / IMAGE_PROCESSING_ERROR / DUPLICATE_REQUEST / INTERNAL; safe Persian messages; no stack traces | `src/services/ai/errors.ts` (new) |
| 19 | **Performance** — provider timeouts (existing) + bounded retries (new) + in-flight duplicate-request join on `/api/ai` (double-click can't double-run) | `app/api/ai/route.ts` |
| 20 | **Observability** — `requestId` on every request (`X-Request-Id`/`_requestId`), structured `[ai]` JSON lines, bounded ring buffer | `telemetry.ts`, `route.ts` |
| 21 | **Tests** — 14 unit tests covering the 7 required scenarios + scope/preservation/context/placement/validation/errors | `scripts/ai-tests/**` |
| 22 | **No UI changes** — verified: no `.tsx`/`.css`/`.scss`/layout/design-system file modified | `git diff` |
| 23 | **Build** — `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:ai` all green | — |

---

## Usage

```bash
npm run test:ai    # AI engine unit tests (node:test, zero extra deps)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # next build
```

Env additions (all optional):

```
# AI_SERVER_CREDITS=1   → authoritative server-side credit gate (needs DATABASE_URL + auth)
# AI_DEBUG=1            → structured per-request telemetry lines
```

## Known limits / deferred (reported, NOT done — UI freeze)

- The designer page still calls `aiService.generate`; switching it to the
  full `pipeline` is a **UI-layer change** (page logic) and was deferred by
  the "do not change UI" rule. The pipeline + context engine are fully
  implemented and testable; wiring is one `page.tsx` edit when allowed.
- Server-side credits stay **off by default**: the current UI charges
  optimistically on the client; enabling `AI_SERVER_CREDITS=1` before that
  is removed would double-charge. Flip it in the same deployment that
  switches the designer to the pipeline + real auth.
- Room understanding (`RoomObject`) is type-level today — filling it from a
  real vision model is a provider task (Orali/Gemini), not a UI task.
