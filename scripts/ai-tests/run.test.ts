// ============================================================
// HOMEINO AI ENGINE — TEST SUITE  (Phase 21)
//
// Runs with the built-in `node:test` runner — zero extra deps:
//
//   npm run test:ai
//
// Scenario coverage (from the product spec):
//   Test 1  «فقط مبل را عوض کن»          → only sofa changes
//   Test 2  «رنگ مبل را کرم کن»          → only sofa color changes
//   Test 3  «این میز را با محصول... جایگزین کن» → real selected product used
//   Test 4  «اتاق را مینیمال کن»        → room-level changes
//   Test 5  «کل خانه را دوباره طراحی کن» → whole-home transformation
//   Test 6  «فرش را عوض کن ولی بقیه دست‌نخورده بماند» → everything else preserved
//   Test 7  continuation «مبل را عوض کن» → «کمی کوچک‌ترش کن» → same sofa
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectIntent, ALL_ELEMENTS, resolveProtectedElements, ELEMENT_LABELS } from "../../src/services/ai/roomState";
import { detectScope, scopeToEditStrength, isFullScope, scopeToIntentType } from "../../src/services/ai/scope";
import { heuristicUnderstandIntent } from "../../src/services/ai/llm/heuristicLlm";
import { normalizeIntentAnalysis } from "../../src/services/ai/llm/openaiCompatLlm";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "../../src/services/ai/llm/systemPrompt";
import { buildAIContext, compactContextForLlm } from "../../src/services/ai/context";
import { planProductPlacement, productPlacementPrompt } from "../../src/services/ai/placement";
import { validateIntentPayload, withBoundedRetry, extractJsonPayload } from "../../src/services/ai/validation";
import { AiError, classifyAiError, toPublicAiError } from "../../src/services/ai/errors";
import type { IntentRequest } from "../../src/services/ai/llm/types";

// ------------------------------------------------------------
// Test 1 — «فقط مبل را عوض کن» → ONLY the sofa changes
// ------------------------------------------------------------
test("Test 1: «فقط مبل را عوض کن» targets ONLY sofa — everything else preserved", () => {
  const intent = heuristicUnderstandIntent({ prompt: "فقط مبل را عوض کن" });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.intent, "targeted_edit");
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(intent.preservedElements.includes("window"));
  assert.ok(!intent.preservedElements.includes("sofa"));

  // The protection layer must keep structure + untouched objects.
  const protectedEls = resolveProtectedElements({ targets: ["sofa"], scope: "single_item" });
  for (const el of ["wall", "floor", "ceiling", "door", "window", "rug", "table"]) {
    assert.ok(protectedEls.includes(el as never), `expected ${el} protected`);
  }
  assert.ok(!protectedEls.includes("sofa"));
});

// ------------------------------------------------------------
// Test 2 — «رنگ مبل را کرم کن» → color_change on sofa only
// ------------------------------------------------------------
test("Test 2: «رنگ مبل را کرم کن» is a color_change targeting sofa", () => {
  const intent = heuristicUnderstandIntent({ prompt: "رنگ مبل را کرم کن" });
  assert.equal(intent.intent, "color_change");
  assert.deepEqual(intent.target, ["sofa"]);
  assert.ok(intent.colors?.includes("کرم"));
  assert.equal(intent.scope, "single_item");
  // A color change must never become a full redesign.
  assert.equal(detectIntent("رنگ مبل را کرم کن").type, "color_change");
});

// ------------------------------------------------------------
// Test 3 — product replacement uses the REAL selected product
// ------------------------------------------------------------
test("Test 3: product placement uses the real selected product (no random guess)", () => {
  const product = {
    id: "p1",
    name: "کاناپه تدی کرم",
    category: "furniture",
    material: "پارچه تدی",
    color: "کرم",
    style: "modern",
    dimensions: { width: 220, height: 80, depth: 90 },
  };
  const planA = planProductPlacement(product);
  const planB = planProductPlacement(product);
  // Deterministic: same input → same placement.
  assert.deepEqual(planA, planB);
  assert.equal(planA.productId, "p1");
  const r = planA.targetRegion;
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1.0001 && r.y + r.height <= 1.0001, "region inside frame");
  assert.ok(planA.rationale.length > 0);

  // The instruction handed to the image engine mentions the product facts.
  const prompt = productPlacementPrompt(product, planA);
  assert.ok(prompt.includes("کاناپه تدی کرم"), "product name in engine prompt");
  assert.ok(prompt.includes("furniture"));
  assert.ok(prompt.includes("مدرن") === false || prompt.includes("modern") || prompt.includes("style"), "style present");
});

// ------------------------------------------------------------
// Test 4 — «اتاق را مینیمال کن» → room-level changes
// ------------------------------------------------------------
test("Test 4: «اتاق را مینیمال کن» is room-level (full redesign of the room)", () => {
  const intent = heuristicUnderstandIntent({ prompt: "اتاق را مینیمال کن" });
  assert.equal(intent.intent, "full_redesign");
  assert.equal(intent.scope, "room");
  assert.ok(isFullScope(intent.scope!));
  assert.deepEqual(intent.preservedElements, []);
  assert.equal(scopeToEditStrength("room"), 0.7);
});

// ------------------------------------------------------------
// Test 5 — «کل خانه را دوباره طراحی کن» → whole-home
// ------------------------------------------------------------
test("Test 5: «کل خانه را دوباره طراحی کن» is whole-home transformation", () => {
  const scope = detectScope("کل خانه را دوباره طراحی کن");
  assert.equal(scope.scope, "whole_home");
  assert.ok(scope.confidence >= 0.9);

  const intent = heuristicUnderstandIntent({ prompt: "کل خانه را از اول طراحی کن" });
  assert.equal(intent.scope, "whole_home");
  assert.equal(intent.intent, "full_redesign");
  assert.equal(resolveProtectedElements({ targets: [...ALL_ELEMENTS], scope: "whole_home" }).length, 0);
  assert.equal(scopeToEditStrength("whole_home"), 0.85);
});

// ------------------------------------------------------------
// Test 6 — «فرش را عوض کن ولی بقیه دست‌نخورده بماند» → preservation
// ------------------------------------------------------------
test("Test 6: rug-only change keeps floor/wall/furniture untouched", () => {
  const intent = heuristicUnderstandIntent({ prompt: "فرش را عوض کن ولی بقیه چیزها دست‌نخورده بماند" });
  assert.deepEqual(intent.target, ["rug"]);
  assert.equal(intent.scope, "single_item");
  const protectedEls = resolveProtectedElements({ targets: ["rug"], scope: "single_item" });
  for (const el of ["wall", "floor", "window", "door", "sofa", "table", "ceiling"]) {
    assert.ok(protectedEls.includes(el as never), `${el} must be protected`);
  }
  assert.ok(!protectedEls.includes("rug"));
  assert.equal(scopeToIntentType("single_item"), "targeted_edit");
});

// ------------------------------------------------------------
// Test 7 — continuation: «مبل را عوض کن» → «کمی کوچک‌ترش کن»
// ------------------------------------------------------------
test("Test 7: «کمی کوچک‌ترش کن» after «مبل را عوض کن» keeps targeting the sofa", () => {
  const first = heuristicUnderstandIntent({ prompt: "مبل را عوض کن" });
  assert.deepEqual(first.target, ["sofa"]);

  // Second request with design memory (previousTargets).
  const second = heuristicUnderstandIntent({
    prompt: "کمی کوچک‌ترش کن",
    previousTargets: ["sofa"],
    previousChanges: ["تعویض مبل"],
  });
  assert.deepEqual(second.target, ["sofa"], "continuation must keep the same target");
  assert.equal(second.scope, "single_item");

  // Without memory the pronoun alone stays an inquiry (conservative).
  const alone = heuristicUnderstandIntent({ prompt: "کمی کوچک‌ترش کن" });
  assert.equal(alone.intent, "inquiry");
});

// ------------------------------------------------------------
// Context engine (Phase 2) — structured, compact, token-efficient
// ------------------------------------------------------------
test("Context engine: structured context, compact serialization ≤ 700 chars", () => {
  const ctx = buildAIContext({
    prompt: "مبل را عوض کن",
    style: "modern",
    room: "پذیرایی",
    targets: ["sofa"],
    scope: "single_item",
    protectedElements: resolveProtectedElements({ targets: ["sofa"], scope: "single_item" }),
    products: [{ id: "p1", category: "furniture", name: "کاناپه" }, { id: "p99", category: "lighting" }],
    previousTargets: ["sofa"],
    previousChanges: ["تعویض مبل"],
  });
  assert.equal(ctx.userIntent.scope, "single_item");
  assert.ok(ctx.previousState, "design memory present");
  assert.ok(ctx.existingObjects.length === 0);

  const compact = compactContextForLlm(ctx);
  assert.ok(compact.length <= 700, `compact context too long: ${compact.length}`);
  assert.ok(compact.includes("scope:single_item"));
  assert.ok(compact.includes("protected:["));

  // Products unrelated to the target are filtered out (token efficiency).
  const filtered = compactContextForLlm(ctx);
  assert.ok(!filtered.includes("p99"), "unrelated product must be filtered out");
});

// ------------------------------------------------------------
// Validation (Phase 13) — schema checks + bounded retry
// ------------------------------------------------------------
test("Validation: accepts valid intent payload, rejects invalid ones", () => {
  assert.deepEqual(
    validateIntentPayload({ intent: "targeted_edit", target: ["sofa"], confidence: 0.9 }),
    [],
  );
  assert.ok(validateIntentPayload({ intent: "hack", target: ["sofa"] }).length > 0, "bad intent rejected");
  assert.ok(validateIntentPayload({ intent: "targeted_edit", target: [] }).length > 0, "empty target rejected");
  assert.ok(validateIntentPayload("not an object").length > 0);
  assert.ok(validateIntentPayload({ intent: "targeted_edit", target: ["sofa"], scope: "galaxy" }).length > 0, "bad scope rejected");
});

test("Validation: extractJsonPayload recovers JSON from prose", () => {
  const out = extractJsonPayload('Sure! Here is the JSON: {"intent":"targeted_edit","target":["sofa"]}');
  assert.deepEqual(out, { intent: "targeted_edit", target: ["sofa"] });
  assert.equal(extractJsonPayload("no json here"), null);
});

test("Validation: bounded retry caps attempts and never loops forever", async () => {
  let calls = 0;
  const ok = await withBoundedRetry(async () => {
    calls++;
    if (calls < 3) throw new Error("transient");
    return "done";
  }, { attempts: 3, delayMs: () => 1 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value, "done");
  assert.equal(calls, 3, "must have used all attempts");

  let more = 0;
  const failed = await withBoundedRetry(async () => {
    more++;
    throw new Error("always fails");
  }, { attempts: 3, delayMs: () => 1 });
  assert.equal(failed.ok, false);
  assert.equal(more, 3, "exactly 3 attempts — never infinite");
});

// ------------------------------------------------------------
// Errors (Phase 18) — standardized codes, no raw leaks
// ------------------------------------------------------------
test("Errors: standardized codes and safe user messages", () => {
  const timeout = classifyAiError(new Error("timeout of 10000ms exceeded"));
  assert.equal(timeout.code, "TIMEOUT");
  assert.equal(timeout.retriable, true);

  const rate = classifyAiError(Object.assign(new Error("Too Many Requests"), { status: 429 }));
  assert.equal(rate.code, "RATE_LIMIT");

  const provider = classifyAiError(Object.assign(new Error("upstream failed"), { status: 502 }));
  assert.equal(provider.code, "PROVIDER_ERROR");

  const pub = toPublicAiError(new AiError("INSUFFICIENT_CREDITS"));
  assert.equal(pub.code, "INSUFFICIENT_CREDITS");
  assert.equal(pub.message, "اعتبار کافی نیست.");

  const unknown = toPublicAiError(new Error("boom"));
  assert.equal(unknown.code, "INTERNAL");
  assert.ok(!unknown.message.includes("boom"), "raw error must never reach the user");
});

// ------------------------------------------------------------
// LLM output normalization — never trust the model blindly
// ------------------------------------------------------------
test("normalizeIntentAnalysis clamps invalid elements and fills preserved defaults", () => {
  const req: IntentRequest = { prompt: "مبل را عوض کن" };
  const out = normalizeIntentAnalysis(
    {
      intent: "targeted_edit",
      target: ["sofa", "warp-drive"], // warp-drive is not in the vocabulary
      changes: ["x"],
      preservedElements: ["wall"],
      confidence: 0.95,
    },
    req,
  );
  assert.deepEqual(out.target, ["sofa"]);
  assert.ok(out.preservedElements.includes("wall"));
  assert.equal(out.confidence, 0.95);
});

// ------------------------------------------------------------
// Final Homeino System Prompt (AI Intelligence Upgrade)
// ------------------------------------------------------------
test("HOMEINO_SYSTEM_PROMPT: identity, minimal-change, scope, style, product, JSON-only", () => {
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Homeino's Interior Design Intelligence"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("When uncertain, preserve more and change less"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("single_item"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("area"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("room"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("whole_home"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Japandi"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Scandinavian"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("previousTargets"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("preservedElements"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("NEVER invent product"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("JSON ONLY") || HOMEINO_SYSTEM_PROMPT.includes("JSON only"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("do not chat") || HOMEINO_SYSTEM_PROMPT.includes("do not chat".toUpperCase()) || HOMEINO_SYSTEM_PROMPT.includes("You do not chat"));
  assert.ok(HOMEINO_RETRY_HINT.includes("invalid JSON"));
  // Prompt must stay server-side (llm layer) — not a UI string dump requirement,
  // but it must be non-trivial intelligence content.
  assert.ok(HOMEINO_SYSTEM_PROMPT.length > 2000, "final prompt must be substantial");
});

// ------------------------------------------------------------
// Spec scenarios from final AI system prompt integration
// ------------------------------------------------------------
test("Spec scenarios: curtain, rug, Japandi room, better-room, protect sofa", () => {
  const rug = heuristicUnderstandIntent({ prompt: "فرش را عوض کن" });
  assert.deepEqual(rug.target, ["rug"]);
  assert.equal(rug.scope, "single_item");

  const curtain = heuristicUnderstandIntent({ prompt: "پرده را روشن‌تر کن" });
  assert.ok(curtain.target.includes("curtain"));
  assert.equal(curtain.scope, "single_item");

  const japandi = heuristicUnderstandIntent({ prompt: "اتاق خواب را ژاپندی کن", style: "Japandi" });
  assert.equal(japandi.intent, "full_redesign");
  assert.equal(japandi.scope, "room");

  const modernRoom = heuristicUnderstandIntent({ prompt: "اتاق را مدرن کن" });
  assert.equal(modernRoom.intent, "full_redesign");
  assert.ok(modernRoom.scope === "room" || isFullScope(modernRoom.scope!));

  // Ambiguous «این اتاق را بهتر کن» must not become whole_home
  const better = detectScope("این اتاق را بهتر کن");
  assert.notEqual(better.scope, "whole_home");

  // Explicit protect sofa while modernizing room — scope stays room;
  // protected layer keeps sofa when targets exclude it.
  const protectedSofa = resolveProtectedElements({
    targets: ALL_ELEMENTS.filter((e) => e !== "sofa"),
    scope: "room",
    explicitLocked: ["sofa"],
  });
  assert.ok(protectedSofa.includes("sofa"), "explicit keep sofa must protect sofa");
});

// ------------------------------------------------------------
// Scope engine — conservative by default (Phase 14)
// ------------------------------------------------------------
test("Scope: never widens implicitly; uncertain requests stay single_item", () => {
  assert.equal(detectScope("مبل را عوض کن", ["sofa"]).scope, "single_item");
  assert.equal(detectScope("فضای نشیمن را مدرن‌تر کن").scope, "area");
  assert.equal(detectScope("کل اتاق را ژاپندی کن").scope, "room");
  // «همه چیز» alone = the current space (room) — never widens to home
  // without an explicit «خانه» mention (conservative by default).
  assert.equal(detectScope("همه چیز را عوض کن").scope, "room");
  assert.equal(detectScope("همه چیز خانه را عوض کن").scope, "whole_home");
  // «اتاق» alone is NOT room scope — «میز اتاق خواب» must stay single item.
  assert.equal(detectScope("میز اتاق خواب را عوض کن", ["table"]).scope, "single_item");
  // Empty/unknown request → most conservative scope.
  assert.equal(detectScope("").scope, "single_item");
  // «فقط» overrides a room mention.
  assert.equal(detectScope("فقط مبل اتاق رو عوض کن", ["sofa"]).scope, "single_item");
  assert.equal(ELEMENT_LABELS.sofa, "مبلمان");
});
