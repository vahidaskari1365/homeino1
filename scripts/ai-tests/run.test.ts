// ============================================================
// HOMEINO AI ENGINE — COMPREHENSIVE TEST SUITE
//
// Runs with the built-in `node:test` runner — zero extra deps:
//
//   npm run test:ai
//
// Scenario coverage (from FINAL AI BEHAVIOR PATCH):
//   1. Selected Option = Selected Category
//   2. Selected Category controls transformation
//   3. User Request priority over selection
//   4. No Selection = Full Design Freedom (Furniture & Decor)
//   5. Full Redesign (room & whole_home)
//   6. Architecture Protection by default
//   7. Explicit Architectural changes
//   8. Continuation memory
//   9. Image & Room Analysis accuracy & confidence
//   10. Analysis → Recommendations coherence
//   11. Product matching from real catalog
//   12. User overrides analyzed style
//   13. Context engine & compact serialization
//   14. Validation & Bounded Retry
//   15. Error codes & user messages
//   16. System prompt compliance
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectIntent,
  ALL_ELEMENTS,
  STRUCTURAL_ELEMENTS,
  DESIGNABLE_ELEMENTS,
  resolveProtectedElements,
  ELEMENT_LABELS,
  matchProducts,
  type ProductCatalogEntry,
} from "../../src/services/ai/roomState";
import { detectScope, scopeToEditStrength, isFullScope, scopeToIntentType } from "../../src/services/ai/scope";
import { heuristicUnderstandIntent } from "../../src/services/ai/llm/heuristicLlm";
import { normalizeIntentAnalysis } from "../../src/services/ai/llm/openaiCompatLlm";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "../../src/services/ai/llm/systemPrompt";
import { buildAIContext, compactContextForLlm } from "../../src/services/ai/context";
import { planProductPlacement, productPlacementPrompt } from "../../src/services/ai/placement";
import { validateIntentPayload, withBoundedRetry, extractJsonPayload } from "../../src/services/ai/validation";
import { AiError, classifyAiError, toPublicAiError } from "../../src/services/ai/errors";
import { mockAiProvider } from "../../src/services/ai/mockAiService";
import { buildDesignInstruction } from "../../src/services/ai/pipeline";
import type { IntentRequest } from "../../src/services/ai/llm/types";

// ------------------------------------------------------------
// Test 1: Selected Category = Selected Target (Sofa → تغییر مبل)
// ------------------------------------------------------------
test("Test 1: Selected Sofa with «تغییرش بده» targets ONLY sofa — everything else preserved", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "تغییرش بده",
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.intent, "targeted_edit");
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(intent.preservedElements.includes("window"));
  assert.ok(intent.preservedElements.includes("rug"));
  assert.ok(intent.preservedElements.includes("lighting"));
  assert.ok(!intent.preservedElements.includes("sofa"));

  // Protection layer
  const protectedEls = resolveProtectedElements({ targets: ["sofa"], scope: "single_item" });
  for (const el of ["wall", "floor", "ceiling", "door", "window", "rug", "table", "chair"]) {
    assert.ok(protectedEls.includes(el as never), `expected ${el} protected`);
  }
  assert.ok(!protectedEls.includes("sofa"));
});

// ------------------------------------------------------------
// Test 2: Selected Category controls transformation (Sofa → مدرنش کن)
// ------------------------------------------------------------
test("Test 2: Selected Sofa with «مدرنش کن» changes ONLY sofa style", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "مدرنش کن",
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.intent, "targeted_edit");
  assert.equal(intent.style, "Modern");
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(intent.preservedElements.includes("rug"));
  assert.ok(!intent.preservedElements.includes("sofa"));
});

// ------------------------------------------------------------
// Test 3: Selected Sofa → «رنگش رو کرم کن» (color_change on sofa)
// ------------------------------------------------------------
test("Test 3: Selected Sofa with «رنگش رو کرم کن» is a color_change targeting sofa", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "رنگش رو کرم کن",
  });
  assert.equal(intent.intent, "color_change");
  assert.deepEqual(intent.target, ["sofa"]);
  assert.ok(intent.colors?.includes("کرم"));
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
});

// ------------------------------------------------------------
// Test 4: Selected Rug → «تغییر فرش / رنگش را عوض کن»
// ------------------------------------------------------------
test("Test 4: Selected Rug keeps floor/wall/furniture untouched", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["rug"],
    prompt: "رنگش را عوض کن",
  });
  assert.deepEqual(intent.target, ["rug"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.intent, "color_change");
  const protectedEls = resolveProtectedElements({ targets: ["rug"], scope: "single_item" });
  for (const el of ["wall", "floor", "window", "door", "sofa", "table", "ceiling"]) {
    assert.ok(protectedEls.includes(el as never), `${el} must be protected`);
  }
  assert.ok(!protectedEls.includes("rug"));
});

// ------------------------------------------------------------
// Test 5: Selected Lighting → «بهترش کن»
// ------------------------------------------------------------
test("Test 5: Selected Lighting with «بهترش کن» targets ONLY lighting", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["lighting"],
    prompt: "بهترش کن",
  });
  assert.deepEqual(intent.target, ["lighting"]);
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("sofa"));
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
});

// ------------------------------------------------------------
// Test 6: Selected Curtains → «تغییر پرده»
// ------------------------------------------------------------
test("Test 6: Selected Curtain with «تغییرش بده» targets ONLY curtain", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["curtain"],
    prompt: "تغییرش بده",
  });
  assert.deepEqual(intent.target, ["curtain"]);
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.preservedElements.includes("window"));
  assert.ok(intent.preservedElements.includes("wall"));
});

// ------------------------------------------------------------
// Test 7: User Request Priority over selection (Selected Sofa + «کل اتاق را Japandi کن»)
// ------------------------------------------------------------
test("Test 7: User explicit room request overrides category selection", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "کل اتاق را Japandi کن",
  });
  assert.equal(intent.intent, "full_redesign");
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  // All designable elements can change
  for (const el of DESIGNABLE_ELEMENTS) {
    assert.ok(intent.target.includes(el), `expected ${el} in designable targets`);
  }
  // Architecture is protected by default!
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `expected architectural ${el} preserved`);
  }
});

// ------------------------------------------------------------
// Test 8: No Selection → «این اتاق رو Japandi کن» (Room Redesign + Architecture Protected)
// ------------------------------------------------------------
test("Test 8: No Selection with «این اتاق رو Japandi کن» redesigns room with architecture protected", () => {
  const intent = heuristicUnderstandIntent({ prompt: "این اتاق رو Japandi کن" });
  assert.equal(intent.intent, "full_redesign");
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  // Designable elements targeted
  for (const el of DESIGNABLE_ELEMENTS) {
    assert.ok(intent.target.includes(el), `expected ${el} in targets`);
  }
  // Architectural elements protected
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `expected architectural ${el} protected`);
  }
});

// ------------------------------------------------------------
// Test 9: No Selection → «این اتاق را مدرن کن»
// ------------------------------------------------------------
test("Test 9: No Selection with «این اتاق را مدرن کن» is room-level with architecture protected", () => {
  const intent = heuristicUnderstandIntent({ prompt: "این اتاق را مدرن کن" });
  assert.equal(intent.intent, "full_redesign");
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Modern");
  // Architecture protected
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `expected ${el} protected`);
  }
});

// ------------------------------------------------------------
// Test 10: General room design requests («این اتاق را زیباتر کن», «یک طراحی بهتر برای این فضا بده»)
// ------------------------------------------------------------
test("Test 10: General design requests give room redesign freedom while preserving architecture", () => {
  const intent1 = heuristicUnderstandIntent({ prompt: "این اتاق را زیباتر کن" });
  assert.equal(intent1.intent, "full_redesign");
  assert.equal(intent1.scope, "room");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent1.preservedElements.includes(el), `expected ${el} protected`);
  }

  const intent2 = heuristicUnderstandIntent({ prompt: "یک طراحی بهتر برای این فضا بده" });
  assert.equal(intent2.intent, "full_redesign");
  assert.equal(intent2.scope, "room");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent2.preservedElements.includes(el), `expected ${el} protected`);
  }
});

// ------------------------------------------------------------
// Test 11: Whole-Home Redesign («کل خانه را مدرن کن»)
// ------------------------------------------------------------
test("Test 11: «کل خانه را مدرن کن» is whole_home with architecture protected by default", () => {
  const scope = detectScope("کل خانه را مدرن کن");
  assert.equal(scope.scope, "whole_home");
  assert.ok(scope.confidence >= 0.9);

  const intent = heuristicUnderstandIntent({ prompt: "کل خانه را مدرن کن" });
  assert.equal(intent.scope, "whole_home");
  assert.equal(intent.intent, "full_redesign");
  assert.equal(intent.style, "Modern");

  // Architecture remains protected even in whole-home by default
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `expected ${el} protected`);
  }
});

// ------------------------------------------------------------
// Test 12: Explicit Architectural Change («دیوار را خراب کن و اتاق را مدرن کن»)
// ------------------------------------------------------------
test("Test 12: Explicit architectural request allows targeted architectural change", () => {
  const intent = heuristicUnderstandIntent({ prompt: "دیوار را خراب کن و اتاق را مدرن کن" });
  assert.equal(intent.intent, "full_redesign");
  assert.ok(intent.target.includes("wall"), "wall must be in target");
  assert.ok(!intent.preservedElements.includes("wall"), "wall should not be preserved");
  // Other structural elements remain protected
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(intent.preservedElements.includes("ceiling"));
  assert.ok(intent.preservedElements.includes("window"));
  assert.ok(intent.preservedElements.includes("door"));
});

// ------------------------------------------------------------
// Test 13: Product placement uses real selected product
// ------------------------------------------------------------
test("Test 13: product placement uses the real selected product (no random guess)", () => {
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
  assert.deepEqual(planA, planB);
  assert.equal(planA.productId, "p1");
  const r = planA.targetRegion;
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 1.0001 && r.y + r.height <= 1.0001, "region inside frame");
  assert.ok(planA.rationale.length > 0);

  const prompt = productPlacementPrompt(product, planA);
  assert.ok(prompt.includes("کاناپه تدی کرم"), "product name in engine prompt");
  assert.ok(prompt.includes("furniture"));
});

// ------------------------------------------------------------
// Test 14: Continuation memory: «مبل را عوض کن» → «کمی کوچک‌ترش کن»
// ------------------------------------------------------------
test("Test 14: «کمی کوچک‌ترش کن» after «مبل را عوض کن» keeps targeting the sofa", () => {
  const first = heuristicUnderstandIntent({ prompt: "مبل را عوض کن" });
  assert.deepEqual(first.target, ["sofa"]);

  const second = heuristicUnderstandIntent({
    prompt: "کمی کوچک‌ترش کن",
    previousTargets: ["sofa"],
    previousChanges: ["تعویض مبل"],
  });
  assert.deepEqual(second.target, ["sofa"], "continuation must keep the same target");
  assert.equal(second.scope, "single_item");

  const alone = heuristicUnderstandIntent({ prompt: "کمی کوچک‌ترش کن" });
  assert.equal(alone.intent, "inquiry");
});

// ------------------------------------------------------------
// Test 15: Upload Image → Room Analysis
// ------------------------------------------------------------
test("Test 15: Room Analysis returns accurate structure, likelyStyle with confidence and honest details", async () => {
  const analysis = await mockAiProvider.analyzeRoom({
    mode: "room-redesign",
    prompt: "تحلیل",
    room: "پذیرایی",
    style: "Scandinavian",
  });

  assert.ok(analysis.roomType);
  assert.ok(analysis.style);
  assert.ok(analysis.likelyStyle);
  assert.equal(typeof analysis.likelyStyle.confidence, "number");
  assert.ok(analysis.likelyStyle.confidence > 0.6);
  assert.ok(analysis.palette.length > 0);
  assert.ok(analysis.strengths.length > 0);
  assert.ok(analysis.opportunities.length > 0);
  assert.ok(analysis.guidedSuggestions.length > 0);
  assert.ok(analysis.architecture);
  assert.ok(analysis.emptySpaces && analysis.emptySpaces.length > 0);
  assert.ok(analysis.functionalIssues && analysis.functionalIssues.length > 0);
  assert.ok(analysis.designOpportunities && analysis.designOpportunities.length > 0);
});

// ------------------------------------------------------------
// Test 16: Analysis → Guided Recommendations
// ------------------------------------------------------------
test("Test 16: Guided suggestions directly address detected opportunities", async () => {
  const analysis = await mockAiProvider.analyzeRoom({ mode: "room-redesign", prompt: "" });

  const rugSugg = analysis.guidedSuggestions.find((s) => s.category === "rug");
  assert.ok(rugSugg, "should recommend rug for undefined seating area");

  const lightSugg = analysis.guidedSuggestions.find((s) => s.category === "lighting");
  assert.ok(lightSugg, "should recommend lighting for poor/overhead-only lighting");

  const artSugg = analysis.guidedSuggestions.find((s) => s.category === "art");
  assert.ok(artSugg, "should recommend art for empty wall");
});

// ------------------------------------------------------------
// Test 17: User Overrides Analyzed Style
// ------------------------------------------------------------
test("Test 17: User request overrides analyzed style in context and intent", () => {
  const roomUnderstanding = {
    roomType: "پذیرایی",
    style: "Scandinavian",
    likelyStyle: { style: "Scandinavian", confidence: 0.78 },
    objects: [],
    confidence: 0.8,
  };

  // User explicitly asks for Japandi
  const ctx = buildAIContext({
    prompt: "اتاق را Japandi کن",
    style: "Japandi",
    targets: [...DESIGNABLE_ELEMENTS],
    scope: "room",
    protectedElements: [...STRUCTURAL_ELEMENTS],
    roomUnderstanding,
  });

  assert.equal(ctx.style?.id, "Japandi");
  assert.equal(ctx.analysisContext?.likelyStyle, "Scandinavian");
});

// ------------------------------------------------------------
// Test 18: Context engine — compact serialization ≤ 700 chars
// ------------------------------------------------------------
test("Test 18: Context engine produces structured compact serialization ≤ 700 chars", () => {
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

  const compact = compactContextForLlm(ctx);
  assert.ok(compact.length <= 700, `compact context too long: ${compact.length}`);
  assert.ok(compact.includes("scope:single_item"));
  assert.ok(compact.includes("protected:["));
  assert.ok(!compact.includes("p99"), "unrelated product must be filtered out");
});

// ------------------------------------------------------------
// Test 19: Validation & Bounded Retry
// ------------------------------------------------------------
test("Test 19: Validation accepts valid intent payloads, rejects invalid ones", () => {
  assert.deepEqual(
    validateIntentPayload({ intent: "targeted_edit", target: ["sofa"], confidence: 0.9 }),
    [],
  );
  assert.ok(validateIntentPayload({ intent: "hack", target: ["sofa"] }).length > 0, "bad intent rejected");
  assert.ok(validateIntentPayload({ intent: "targeted_edit", target: [] }).length > 0, "empty target rejected");
  assert.ok(validateIntentPayload("not an object").length > 0);
});

test("Test 19b: Validation extractJsonPayload and bounded retry", async () => {
  const out = extractJsonPayload('JSON: {"intent":"targeted_edit","target":["sofa"]}');
  assert.deepEqual(out, { intent: "targeted_edit", target: ["sofa"] });

  let calls = 0;
  const ok = await withBoundedRetry(async () => {
    calls++;
    if (calls < 3) throw new Error("transient");
    return "done";
  }, { attempts: 3, delayMs: () => 1 });
  assert.equal(ok.ok, true);
  assert.equal(calls, 3);
});

// ------------------------------------------------------------
// Test 20: Standardized Error Handling
// ------------------------------------------------------------
test("Test 20: Standardized error codes and safe user messages", () => {
  const timeout = classifyAiError(new Error("timeout of 10000ms exceeded"));
  assert.equal(timeout.code, "TIMEOUT");

  const pub = toPublicAiError(new AiError("INSUFFICIENT_CREDITS"));
  assert.equal(pub.code, "INSUFFICIENT_CREDITS");
  assert.equal(pub.message, "اعتبار کافی نیست.");
});

// ------------------------------------------------------------
// Test 21: System Prompt compliance
// ------------------------------------------------------------
test("Test 21: HOMEINO_SYSTEM_PROMPT includes all final behavior rules", () => {
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Homeino's Interior Design Intelligence"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("SELECTED OPTION = SELECTED CATEGORY"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("ARCHITECTURE NEVER CHANGES BY DEFAULT"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("single_item"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("whole_home"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Japandi"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("Scandinavian"));
  assert.ok(HOMEINO_SYSTEM_PROMPT.includes("JSON ONLY"));
  assert.ok(HOMEINO_RETRY_HINT.includes("invalid JSON"));
});

// ------------------------------------------------------------
// Test 22: Pipeline Instruction Architecture Preservation
// ------------------------------------------------------------
test("Test 22: Pipeline buildDesignInstruction preserves architecture on full room redesign", () => {
  const inst = buildDesignInstruction(
    {
      prompt: "این اتاق را مدرن کن",
      scope: "full",
    },
    {
      intent: "full_redesign",
      target: [...DESIGNABLE_ELEMENTS],
      changes: ["بازطراحی مدرن"],
      preservedElements: [...STRUCTURAL_ELEMENTS],
      scope: "room",
      style: "Modern",
      confidence: 0.9,
    },
  );

  assert.equal(inst.scope, "room");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(inst.protectedElements.includes(el), `expected ${el} protected in instruction`);
    assert.ok(inst.preserved.includes(el), `expected ${el} preserved in instruction`);
  }
  assert.ok(inst.enginePrompt.includes("PROTECTED ARCHITECTURE"));
});

// ------------------------------------------------------------
// Test 23: Real Catalog Product Matching (No fake products)
// ------------------------------------------------------------
test("Test 23: matchProducts uses real catalog entries only", () => {
  const catalog: ProductCatalogEntry[] = [
    { id: "p1", category: "furniture", styleSlugs: ["modern"], price: 1000, inStock: true },
    { id: "p9", category: "lighting", styleSlugs: ["modern"], price: 500, inStock: true },
    { id: "p12", category: "rugs", styleSlugs: ["modern"], price: 800, inStock: true },
  ];

  const matched = matchProducts(
    catalog,
    {
      type: "partial_edit",
      targets: ["sofa"],
      requestedChanges: [],
      lockedElements: [],
      confidence: 0.9,
      requiresClarification: false,
    },
    { modern: "modern" },
  );

  assert.ok(matched.length > 0);
  assert.equal(matched[0].productId, "p1");
});
