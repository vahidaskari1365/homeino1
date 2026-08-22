# Homeino AI — Architecture

> The AI feature is a **product capability**, not a landing page.
> Clicking «هوش مصنوعی» lands **directly in the AI Designer** at `/ai`.

## Routing

| Route | What it is |
|---|---|
| `/ai` | **AI Designer** — the main AI experience (upload → describe → طراحی کن → result) |
| `/ai/design` | HTTP 307 → `/ai` (legacy deep links, query forwarded) |
| `/ai/history` | Previous designs: thumbnail · date · prompt · style · status · reopen · delete |
| `/ai/result/[id]` | Saved result view (before/after, regions, download, re-edit, products) |

## Layered architecture

```
UI (AI Designer — /ai)
   │  never imports a provider, never sees a key
   ▼
aiService (src/services/ai/index.ts)
   │  fetch /api/ai  { action, payload }
   ▼
/api/ai route  (validation · rate limit · sanitization · requestId ·
                duplicate-request join · standardized AI errors)
   │
   ├─ action "understand" ──► LLM Service (src/services/ai/llm)
   │                             ├─ openaiCompatLlm  (env LLM_API_* — any OpenAI-compatible endpoint,
   │                             │                    schema-validated, bounded retry ×3)
   │                             └─ heuristicLlm     (deterministic fallback — never fails,
   │                                                  scope-aware + design-memory aware)
   │
   └─ action "pipeline" ──► Design Pipeline (src/services/ai/pipeline.ts)
                              0. AI Context Engine     → AIContext (room/objects/intent/style/
                                                         products/budget/previousState) — compact ≤700 chars
                              1. LLM Intent Understanding → { intent, target, changes, scope,
                                                              preservedElements, style, colors, confidence }
                              2. Change Scope           → single_item | area | room | whole_home
                              3. Protected Elements     → structural defaults + untouched objects
                              4. Product Placement      → real-product targetRegion plan (no random)
                              5. Design Instruction     → targets + hard preservation constraints
                              6. Image / Overlay Generation → Orali first (real overlay metadata),
                                                              base provider fallback (mock/gemini/…)
                              7. Result Validation      → completed | preview | failed (never fake success)
                              8. Result Display         → PipelineResult contract consumed by the UI
```

Supporting engine modules (all pure / server-only):

| Module | Responsibility |
|---|---|
| `scope.ts` | Change-scope detection (Phase 4) — conservative, never widens implicitly |
| `context.ts` | Structured AI context + compact serialization (Phases 2/12/15) |
| `placement.ts` | Product-aware placement planner (Phases 7/8) |
| `validation.ts` | LLM JSON schema validation + bounded retry (Phase 13) |
| `errors.ts` | Standardized AI error codes + safe messages (Phase 18) |
| `telemetry.ts` | Per-request observability, structured `[ai]` logs (Phase 20) |
| `serverCredits.ts` | Opt-in server-side credit gate: reserve → run → finalize/refund (Phase 17) |

Swapping the LLM or the image engine is **env-only** — zero UI changes.
See `docs/ai-engine-upgrade.md` for the full phase-by-phase report.

## Environment variables

| Variable | Layer | Purpose |
|---|---|---|
| `LLM_API_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | LLM | Any OpenAI-compatible chat endpoint (FreeLLMAPI, OpenRouter, …) |
| `ORALI_API_BASE_URL` / `ORALI_API_KEY` / `ORALI_MODEL` | Orali | Real image-edit + overlay-region engine |
| `GEMINI_API_KEY` | base provider | Gemini image path (pre-existing) |
| `FREELLMAPI_API_KEY` / `FREELLMAPI_BASE_URL` | base provider | FreeLLMAPI path (pre-existing) |

Nothing configured → heuristic LLM + mock image provider, and every result is
honestly labeled **پیش‌نمایش** (`preview`), never a fake success.

## LLM output contract (structured, tiny)

Intent analysis must return **only**:

```json
{ "intent": "targeted_edit", "target": ["sofa"], "changes": ["مبل را عوض کن"],
  "preservedElements": ["wall", "floor"], "style": "مدرن", "colors": ["کرم"], "confidence": 0.9 }
```

- Hard cap `max_tokens ≤ 220`, `temperature 0.2`, JSON mode.
- Every model answer is re-validated against the element vocabulary and normalized;
  invalid readings degrade to the deterministic heuristic engine.
- The LLM understands: room · object · furniture · wall · floor · ceiling ·
  lighting · decor · color · material · style.

## The golden rule — scoped change

> **AI never changes the whole room without the user's explicit permission.**

- «مبل را عوض کن» → only `sofa` changes.
- «رنگ دیوار را کرم کن» → only `wall` color changes.
- «این اتاق را مدرن کن» → full redesign allowed.

Preserved by default: layout · perspective · architecture · windows · doors ·
walls · floor · ceiling (unless full redesign is explicitly requested).
The pipeline compiles these into `constraintsToPrompt()` rules for the image engine.

## Overlay model (real, not fake)

- `OverlayRegion { id, label, element, box(x,y,w,h), mask?, status }` — normalized metadata.
- Boxes are produced by **Orali** only. When no real engine ran, `regions` stays
  empty and the UI says so — fake boxes over the image are never drawn.
- The UI contract is: `original image + generated result + editable overlay metadata`.

## AI states (`src/services/ai/states.ts`)

`idle · uploading · analyzing · understanding · generating · processing ·
success · partial-success · error · retry · no-result`

Busy states always render the premium `AiPhaseLoader` (staged stepper, animated
progress, rotating tips, elapsed timer) — the page is never blank or frozen.

## Credits (frontend-ready, backend later)

- Before generation: cost shown (`targeted edit = 3`, `full redesign = 5`).
- Generation runs through `runAiOperation`: reserve → execute → commit / refund.
- Insufficient credits: inline explanation + «خرید اعتبار» → `/account/credits`.

## History (`src/stores/useDesignSessions.ts`)

Persisted client-side store (compressed thumbnails, quota-safe). Each session:
thumbnail · date · prompt · style · scope/targets · status · credits · regions ·
products. `?session=<id>` reopens a session inside the designer for re-editing.
The store shape is the contract for the future `/api/designs` backend.
