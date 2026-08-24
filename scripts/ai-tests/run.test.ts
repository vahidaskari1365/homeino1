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
import { detectScope, resolveScope, scopeToEditStrength, isFullScope, scopeToIntentType } from "../../src/services/ai/scope";
import { heuristicUnderstandIntent } from "../../src/services/ai/llm/heuristicLlm";
import { normalizeIntentAnalysis } from "../../src/services/ai/llm/openaiCompatLlm";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "../../src/services/ai/llm/systemPrompt";
import { buildAIContext, buildFinalAiContext, compactContextForLlm } from "../../src/services/ai/context";
import { planProductPlacement, productPlacementPrompt, productIdentityPrompt } from "../../src/services/ai/placement";
import {
  resolveProductCode,
  matchStoreProducts,
  matchAfterGeneration,
  mapUiSelectionToTargets,
  categoryToTarget,
  toMatchableProduct,
  INVALID_SKU_MESSAGE,
  CATEGORY_SKU_CONFLICT_MESSAGE,
  type MatchableProduct,
} from "../../src/services/ai/productMatching";
import { products, PRODUCT_SKUS, getProductBySku, getProductById } from "../../src/data/products";
import { stores } from "../../src/data/stores";
import { offers } from "../../src/data/offers";
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

// ============================================================
// ============================================================
//  AI ACCURACY PATCH — TARGETED REGRESSION TESTS (spec section 9)
//  1. Sofa vs Chair        2. Generic "all" keywords
//  3. Single Source of Truth for Scope   4. Explicit Structural
//  5. UI Selection Priority  (+ continuation & LLM normalization)
// ============================================================
// ============================================================

// ------------------------------------------------------------
// Patch Test 1: «مبل را عوض کن» → target = sofa, scope = single_item
// ------------------------------------------------------------
test("Patch T1: «مبل را عوض کن» → target=sofa, scope=single_item", () => {
  const intent = heuristicUnderstandIntent({ prompt: "مبل را عوض کن" });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.intent, "targeted_edit");
  // Scope engine (single source of truth) agrees with the heuristic.
  assert.equal(resolveScope({ text: "مبل را عوض کن" }).scope, "single_item");
  assert.equal(detectScope("مبل را عوض کن").scope, "single_item");
});

// ------------------------------------------------------------
// Patch Test 2: «صندلی را عوض کن» → target = chair, scope = single_item
// ------------------------------------------------------------
test("Patch T2: «صندلی را عوض کن» → target=chair, scope=single_item (chair ≠ sofa)", () => {
  const intent = heuristicUnderstandIntent({ prompt: "صندلی را عوض کن" });
  assert.deepEqual(intent.target, ["chair"]);
  assert.equal(intent.scope, "single_item");
  assert.ok(!intent.target.includes("sofa"), "صندلی must never map to sofa");

  // The reverse must hold too: sofa requests never map to chair.
  const sofa = heuristicUnderstandIntent({ prompt: "مبل را عوض کن" });
  assert.ok(!sofa.target.includes("chair"), "مبل must never map to chair");
  const kanapeh = heuristicUnderstandIntent({ prompt: "کاناپه را عوض کن" });
  assert.deepEqual(kanapeh.target, ["sofa"]);
});

// ------------------------------------------------------------
// Patch Test 3: «chair را تغییر بده» → target = chair
// ------------------------------------------------------------
test("Patch T3: «chair را تغییر بده» → target=chair, scope=single_item", () => {
  const intent = heuristicUnderstandIntent({ prompt: "chair را تغییر بده" });
  assert.ok(intent.target.includes("chair"));
  assert.ok(!intent.target.includes("sofa"), "chair must never map to sofa");
  assert.equal(intent.scope, "single_item");
});

// ------------------------------------------------------------
// Patch Test 4: «همه رو بهتر کن» → NOT whole_home (generic "all" alone)
// ------------------------------------------------------------
test("Patch T4: generic «همه…» prompts never become whole_home / full_redesign", () => {
  for (const prompt of [
    "همه رو بهتر کن",
    "همه اینا رو تغییر بده",
    "همه چیز خوب نیست",
    "همه رو عوض نکن",
  ]) {
    const intent = heuristicUnderstandIntent({ prompt });
    assert.notEqual(intent.scope, "whole_home", `${prompt} must NOT be whole_home`);
    assert.notEqual(intent.intent, "full_redesign", `${prompt} must NOT be full_redesign`);
    // Conservative interpretation: preserve more, change less.
    assert.equal(resolveScope({ text: prompt }).scope, "single_item", `${prompt} → conservative single_item`);
    assert.equal(detectScope(prompt).scope, "single_item", `${prompt} → detectScope conservative`);
  }
});

// ------------------------------------------------------------
// Patch Test 5: «کل خانه را مدرن کن» → scope = whole_home, style = Modern
// ------------------------------------------------------------
test("Patch T5: «کل خانه را مدرن کن» → scope=whole_home, style=Modern, architecture protected", () => {
  const intent = heuristicUnderstandIntent({ prompt: "کل خانه را مدرن کن" });
  assert.equal(intent.scope, "whole_home");
  assert.equal(intent.style, "Modern");
  assert.equal(intent.intent, "full_redesign");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `${el} must stay protected in whole_home`);
  }
});

// ------------------------------------------------------------
// Patch Test 6: «اتاق را Japandi کن» → scope = room, style = Japandi
// ------------------------------------------------------------
test("Patch T6: «اتاق را Japandi کن» → scope=room, style=Japandi, architecture stays protected", () => {
  const intent = heuristicUnderstandIntent({ prompt: "اتاق را Japandi کن" });
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  assert.equal(intent.intent, "full_redesign");
  // Architectural elements remain protected — never targeted.
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `${el} must be preserved`);
    assert.ok(!intent.target.includes(el), `${el} must NOT be targeted by a room restyle`);
  }
});

// ------------------------------------------------------------
// Patch Test 7: «دیوار را تغییر بده» → target = wall (explicit structural OK)
// ------------------------------------------------------------
test("Patch T7: «دیوار را تغییر بده» → target=wall (explicit structural modification allowed)", () => {
  const intent = heuristicUnderstandIntent({ prompt: "دیوار را تغییر بده" });
  assert.ok(intent.target.includes("wall"), "explicit wall request must target wall");
  assert.equal(intent.scope, "single_item");
  // The rest of the architecture stays protected.
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(intent.preservedElements.includes("ceiling"));
  assert.ok(intent.preservedElements.includes("window"));
  assert.ok(intent.preservedElements.includes("door"));
});

// ------------------------------------------------------------
// Patch Test 8: UI Selected = Sofa + «مدرنش کن» → sofa + single_item
// ------------------------------------------------------------
test("Patch T8: UI Selected=Sofa + «مدرنش کن» → target=sofa, scope=single_item", () => {
  const intent = heuristicUnderstandIntent({ selectedTargets: ["sofa"], prompt: "مدرنش کن" });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.style, "Modern");
  assert.ok(intent.preservedElements.includes("chair"), "chair must stay untouched");
});

// ------------------------------------------------------------
// Patch Test 9: UI Selected = Sofa + «کل اتاق را Japandi کن» → room (user intent priority)
// ------------------------------------------------------------
test("Patch T9: UI Selected=Sofa + «کل اتاق را Japandi کن» → scope=room, style=Japandi (NOT single_item)", () => {
  const intent = heuristicUnderstandIntent({ selectedTargets: ["sofa"], prompt: "کل اتاق را Japandi کن" });
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  assert.notEqual(intent.scope, "single_item");
  assert.equal(intent.intent, "full_redesign");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `${el} must be preserved`);
  }
});

// ------------------------------------------------------------
// Patch Test 10: continuation — «مبل را عوض کن» → «کمی کوچک‌ترش کن»
// ------------------------------------------------------------
test("Patch T10: continuation keeps the previous sofa target (single_item)", () => {
  const first = heuristicUnderstandIntent({ prompt: "مبل را عوض کن" });
  assert.deepEqual(first.target, ["sofa"]);

  const second = heuristicUnderstandIntent({
    prompt: "کمی کوچک‌ترش کن",
    previousTargets: first.target,
    previousChanges: ["تعویض مبل"],
  });
  assert.deepEqual(second.target, ["sofa"], "continuation must keep the previous target");
  assert.equal(second.scope, "single_item");
});

// ------------------------------------------------------------
// Patch T10b: a NEW named target replaces the previous continuation target
// ------------------------------------------------------------
test("Patch T10b: «کمی صندلی را کوچک‌تر کن» replaces previous sofa target with chair", () => {
  const intent = heuristicUnderstandIntent({
    prompt: "کمی صندلی را کوچک‌تر کن",
    previousTargets: ["sofa"],
  });
  assert.deepEqual(intent.target, ["chair"]);
  assert.equal(intent.scope, "single_item");
});

// ------------------------------------------------------------
// Patch T11: never trust LLM blindly — over-broad LLM answer is normalized
// ------------------------------------------------------------
test("Patch T11: LLM over-broad answer (all elements / whole_home) normalizes to the user's sofa", () => {
  const normalized = normalizeIntentAnalysis(
    {
      intent: "full_redesign",
      target: [...DESIGNABLE_ELEMENTS, ...STRUCTURAL_ELEMENTS],
      changes: ["بازطراحی کامل"],
      preservedElements: [],
      scope: "whole_home",
      confidence: 0.9,
    },
    { prompt: "مبل را عوض کن" },
  );
  assert.deepEqual(normalized.target, ["sofa"], "LLM scope must normalize down to the user's target");
  assert.equal(normalized.scope, "single_item");
  assert.notEqual(normalized.intent, "full_redesign");
});

test("Patch T11b: LLM may narrow targets within the tree's decision, never widen", () => {
  // Prompt names two items; LLM says only the sofa → narrowing accepted.
  const narrowed = normalizeIntentAnalysis(
    {
      intent: "targeted_edit",
      target: ["sofa"],
      changes: ["تعویض مبل"],
      preservedElements: [],
      scope: "single_item",
      confidence: 0.9,
    },
    { prompt: "مبل و فرش را عوض کن" },
  );
  assert.deepEqual(narrowed.target, ["sofa"]);
  assert.equal(narrowed.scope, "area"); // tree decision wins over the LLM's scope
});

// ------------------------------------------------------------
// Patch T12: «میز اتاق خواب را عوض کن» stays single_item — no bed false-positive
// ------------------------------------------------------------
test("Patch T12: «میز اتاق خواب را عوض کن» → table only (خواب in room name ≠ bed)", () => {
  const intent = heuristicUnderstandIntent({ prompt: "میز اتاق خواب را عوض کن" });
  assert.deepEqual(intent.target, ["table"]);
  assert.equal(intent.scope, "single_item");
  assert.ok(!intent.target.includes("bed"), "room name «اتاق خواب» must not target the bed");
});

// ------------------------------------------------------------
// Patch T13: explicit whole-home phrases still resolve to whole_home
// ------------------------------------------------------------
test("Patch T13: valid explicit whole-home phrases → whole_home", () => {
  for (const prompt of [
    "کل خانه را طراحی کن",
    "کل خونه رو مدرن کن",
    "تمام خانه را بازطراحی کن",
    "همه اتاق‌های خانه را دوباره طراحی کن",
    "خانه را از اول طراحی کن",
  ]) {
    assert.equal(resolveScope({ text: prompt }).scope, "whole_home", prompt);
    assert.equal(heuristicUnderstandIntent({ prompt }).scope, "whole_home", prompt);
  }
});

// ------------------------------------------------------------
// Patch T14: single source of truth — heuristic, scope engine, pipeline agree
// ------------------------------------------------------------
test("Patch T14: heuristic, scope engine and pipeline produce ONE consistent final scope", () => {
  const prompts = [
    "مبل را عوض کن",
    "صندلی را عوض کن",
    "chair را تغییر بده",
    "کل خانه را مدرن کن",
    "اتاق را Japandi کن",
    "دیوار را تغییر بده",
    "همه رو بهتر کن",
    "میز اتاق خواب را عوض کن",
  ];
  for (const prompt of prompts) {
    const heuristic = heuristicUnderstandIntent({ prompt });
    const scopeEngine = detectScope(prompt);
    assert.equal(heuristic.scope, scopeEngine.scope, `scope mismatch for: ${prompt}`);
    // The pipeline instruction must carry the same final scope (fix 3).
    const inst = buildDesignInstruction({ prompt, scope: "targeted" }, heuristic);
    assert.equal(inst.scope, heuristic.scope, `pipeline scope mismatch for: ${prompt}`);
    // Structural protection must hold end-to-end.
    for (const el of STRUCTURAL_ELEMENTS) {
      if (!inst.targets.includes(el)) {
        assert.ok(
          inst.protectedElements.includes(el) || inst.preserved.includes(el),
          `${el} must be protected for: ${prompt}`,
        );
      }
    }
  }
});

// ------------------------------------------------------------
// Patch T15: full redesign targets ALL DESIGNABLE elements, never architecture
// ------------------------------------------------------------
test("Patch T15: room/whole_home redesign opens designable elements, keeps architecture protected", () => {
  for (const prompt of ["اتاق را Japandi کن", "کل خانه را Luxury Contemporary کن"]) {
    const intent = heuristicUnderstandIntent({ prompt });
    assert.ok(isFullScope(intent.scope ?? "single_item"), `${prompt} must be full scope`);
    for (const el of DESIGNABLE_ELEMENTS) {
      assert.ok(intent.target.includes(el), `${prompt}: designable ${el} must be targetable`);
    }
    for (const el of STRUCTURAL_ELEMENTS) {
      assert.ok(!intent.target.includes(el), `${prompt}: structural ${el} must stay protected`);
    }
  }
});

// ============================================================
// PRODUCT SELECTION + SKU + REAL STORE MATCHING
// ============================================================

const CATALOG: MatchableProduct[] = products.map((p) => toMatchableProduct(p, PRODUCT_SKUS[p.id]));
const STORE_ROWS = stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
const OFFER_ROWS = offers.map((o) => ({
  productId: o.productId,
  storeId: o.storeId,
  price: o.price,
  inStock: o.inStock,
  sellerSku: o.sellerSku,
}));

test("SKU patch: UI category only (empty prompt) is a valid generation intent", () => {
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Sofa"] }), ["sofa"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Lighting"] }), ["lighting"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Rug"] }), ["rug"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Chair"] }), ["chair"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Table"] }), ["table"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Curtain"] }), ["curtain"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Decor"] }), ["art"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Bed"] }), ["bed"]);
  assert.deepEqual(mapUiSelectionToTargets({ names: ["Wardrobe"] }), ["shelf"]);

  const intent = heuristicUnderstandIntent({ selectedTargets: ["sofa"], prompt: "" });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.intent, "targeted_edit");
  assert.notEqual(intent.intent, "inquiry");
  assert.ok(!/describe what you want|بنویسید چه چیزی/i.test(intent.note ?? ""));
});

test("SKU patch: UI category + description merges target with color/style", () => {
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "کرم و مدرن",
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.ok(intent.colors?.includes("کرم"));
  assert.equal(intent.style, "Modern");
});

test("SKU patch: UI category + image stays in context (room analysis not dropped)", () => {
  const ctx = buildAIContext({
    prompt: "",
    style: "modern",
    room: "پذیرایی",
    targets: ["sofa"],
    scope: "single_item",
    protectedElements: resolveProtectedElements({ targets: ["sofa"], scope: "single_item" }),
    roomUnderstanding: {
      roomType: "پذیرایی",
      furnitureTypes: ["sofa", "table"],
      emptySpaces: ["دیوار اصلی خالی"],
      objects: [],
      confidence: 0.8,
    },
  });
  assert.equal(ctx.userIntent.targets[0], "sofa");
  assert.equal(ctx.room.type, "پذیرایی");
  assert.equal(ctx.analysisContext?.emptySpaces?.[0], "دیوار اصلی خالی");
});

test("SKU patch: UI category + SKU resolves the real product", () => {
  const resolution = resolveProductCode("SOF-1024", CATALOG, { selectedTargets: ["sofa"] });
  assert.equal(resolution.status, "ok");
  assert.equal(resolution.product?.id, "p1");
  assert.equal(resolution.product?.sku, "SOF-1024");
  assert.equal(resolution.productTarget, "sofa");

  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "",
    selectedProduct: resolution.product,
    sku: "SOF-1024",
  });
  assert.deepEqual(intent.target, ["sofa"]);
});

test("SKU patch: UI category + SKU + description keeps product + style", () => {
  const resolution = resolveProductCode("SOF-1024", CATALOG, { selectedTargets: ["sofa"] });
  assert.equal(resolution.status, "ok");
  const intent = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "Japandi",
    selectedProduct: resolution.product,
    sku: "SOF-1024",
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.style, "Japandi");
  assert.equal(intent.scope, "single_item");
});

test("SKU patch: exact product selection enters AI context", () => {
  const product = getProductById("p1")!;
  const ctx = buildAIContext({
    prompt: "",
    targets: ["sofa"],
    scope: "single_item",
    protectedElements: resolveProtectedElements({ targets: ["sofa"], scope: "single_item" }),
    selectedProduct: {
      id: product.id,
      sku: PRODUCT_SKUS[product.id],
      name: product.name,
      category: product.categorySlug,
      storeId: product.storeId,
      image: product.images[0],
    },
    sku: PRODUCT_SKUS[product.id],
    products: [{ id: product.id, name: product.name, category: product.categorySlug, sku: PRODUCT_SKUS[product.id] }],
  });
  assert.equal(ctx.selectedProduct?.id, "p1");
  assert.equal(ctx.sku, "SOF-1024");
  const compact = compactContextForLlm(ctx);
  assert.ok(compact.includes("sku:SOF-1024") || compact.includes("selectedProduct:p1"));
});

test("SKU patch: invalid SKU does not invent a product", () => {
  const resolution = resolveProductCode("NO-SUCH-SKU-999", CATALOG);
  assert.equal(resolution.status, "not_found");
  assert.equal(resolution.product, undefined);
  assert.equal(resolution.message, INVALID_SKU_MESSAGE);
});

test("SKU patch: category / SKU conflict is detected and not auto-converted", () => {
  const resolution = resolveProductCode("LAMP-552", CATALOG, { selectedTargets: ["sofa"] });
  assert.equal(resolution.status, "conflict");
  assert.equal(resolution.product?.id, "p9");
  assert.equal(resolution.productTarget, "lighting");
  assert.equal(resolution.selectedTarget, "sofa");
  assert.equal(resolution.message, CATEGORY_SKU_CONFLICT_MESSAGE);
  assert.notEqual(resolution.productTarget, "sofa");
});

test("SKU patch: continuation with SKU keeps the previous product target", () => {
  const first = heuristicUnderstandIntent({
    selectedTargets: ["sofa"],
    prompt: "",
    sku: "SOF-1024",
    selectedProduct: { id: "p1", sku: "SOF-1024", category: "furniture", name: "کاناپه هلیم ۳ نفره" },
  });
  assert.deepEqual(first.target, ["sofa"]);

  const second = heuristicUnderstandIntent({
    prompt: "کمی کوچکترش کن",
    previousTargets: first.target,
    previousSku: "SOF-1024",
    previousProductId: "p1",
    selectedProduct: { id: "p1", sku: "SOF-1024", category: "furniture" },
  });
  assert.deepEqual(second.target, ["sofa"]);
  assert.equal(second.scope, "single_item");

  const ctx = buildFinalAiContext({
    target: second.target,
    scope: second.scope,
    selectedProduct: { id: "p1", sku: "SOF-1024" },
    sku: "SOF-1024",
    previousTargets: ["sofa"],
    previousSku: "SOF-1024",
    previousProductId: "p1",
  });
  assert.equal(ctx.previousSku, "SOF-1024");
  assert.equal(ctx.previousProductId, "p1");
  assert.deepEqual(ctx.previousTargets, ["sofa"]);
  assert.ok(!("description" in ctx), "empty description must be omitted");
});

test("SKU patch: generated image → product matching does not invent or rewrite the image", () => {
  const generatedImage = "data:image/png;base64,ORIGINAL";
  const matches = matchAfterGeneration({
    catalog: CATALOG,
    stores: STORE_ROWS,
    offers: OFFER_ROWS,
    targets: ["sofa"],
    style: "modern",
    generatedImage,
  });
  assert.ok(matches.length > 0);
  for (const match of matches) {
    assert.ok(CATALOG.some((p) => p.id === match.productId), `invented product ${match.productId}`);
    assert.ok(match.score > 0);
  }
  assert.equal(generatedImage, "data:image/png;base64,ORIGINAL");
});

test("SKU patch: multi-store results are ranked by relevance, not random", () => {
  const matches = matchStoreProducts({
    catalog: CATALOG,
    stores: STORE_ROWS,
    offers: OFFER_ROWS,
    sku: "SOF-1024",
    productId: "p1",
    targets: ["sofa"],
    style: "modern",
  });
  assert.ok(matches.length >= 2, "exact product should expand to multiple real store offers");
  const storeIds = new Set(matches.map((m) => m.storeId).filter(Boolean));
  assert.ok(storeIds.size >= 2, "multi-store results required");
  assert.equal(matches[0].productId, "p1");
  assert.ok(matches[0].score >= matches[matches.length - 1].score);
  for (const match of matches) {
    if (match.storeName) {
      assert.ok(STORE_ROWS.some((s) => s.name === match.storeName), `invented store ${match.storeName}`);
    }
  }
});

test("SKU patch: no fake products / prices / SKUs / URLs", () => {
  const matches = matchStoreProducts({
    catalog: CATALOG,
    stores: STORE_ROWS,
    targets: ["lighting"],
    style: "modern",
  });
  assert.ok(matches.length > 0);
  for (const match of matches) {
    const real = CATALOG.find((p) => p.id === match.productId);
    assert.ok(real, `fake product id ${match.productId}`);
    if (match.sku) {
      assert.ok(
        real.sku === match.sku || OFFER_ROWS.some((o) => o.productId === real.id && o.sellerSku === match.sku),
        `fake sku ${match.sku}`,
      );
    }
    if (typeof match.price === "number") {
      assert.ok(
        real.price === match.price || OFFER_ROWS.some((o) => o.productId === real.id && o.price === match.price),
        `fake price ${match.price}`,
      );
    }
    if (match.productUrl) {
      assert.equal(match.productUrl, `/products/${real.slug}`);
    }
    if (match.storeId) {
      assert.ok(STORE_ROWS.some((s) => s.id === match.storeId) || match.storeId === real.storeId);
    }
  }
});

test("SKU patch: room analysis boosts living-room compatible products", () => {
  const living = matchStoreProducts({
    catalog: CATALOG,
    stores: STORE_ROWS,
    room: "پذیرایی",
    roomAnalysis: { roomType: "پذیرایی", furnitureTypes: ["sofa"], emptySpaces: ["مرکز نشیمن"] },
    targets: ["sofa"],
  });
  assert.ok(living.length > 0);
  assert.ok(living.some((m) => m.productId === "p1" || categoryToTarget(CATALOG.find((p) => p.id === m.productId)!) === "sofa"));

  const bedroom = matchStoreProducts({
    catalog: CATALOG,
    stores: STORE_ROWS,
    room: "اتاق خواب",
    roomAnalysis: { roomType: "اتاق خواب", furnitureTypes: ["bed"] },
    targets: ["bed"],
  });
  assert.ok(bedroom.length > 0);
  assert.ok(bedroom.every((m) => {
    const p = CATALOG.find((x) => x.id === m.productId);
    return p && (p.categorySlug === "bedroom" || categoryToTarget(p) === "bed");
  }));
});

test("SKU patch: identity prompt locks the real selected product", () => {
  const product = {
    id: "p1",
    name: "کاناپه هلیم ۳ نفره",
    category: "furniture",
    sku: "SOF-1024",
    material: "پارچه کتان",
    color: "کرم",
    style: "modern",
  };
  const text = productIdentityPrompt(product);
  assert.ok(text.includes("IDENTITY LOCK"));
  assert.ok(text.includes("کاناپه هلیم ۳ نفره"));
  assert.ok(text.includes("SOF-1024"));
  assert.ok(/shape|proportions|material|color|design language/i.test(text));
});

test("SKU patch: final context omits empty fields", () => {
  const ctx = buildFinalAiContext({
    target: ["sofa"],
    scope: "single_item",
    sku: "SOF-1024",
  });
  assert.deepEqual(Object.keys(ctx).sort(), ["scope", "sku", "target"].sort());
});

test("SKU patch: getProductBySku only returns catalog rows", () => {
  assert.equal(getProductBySku("SOF-1024")?.id, "p1");
  assert.equal(getProductBySku("HOME-SF-8821")?.id, "p29");
  assert.equal(getProductBySku("LAMP-552")?.id, "p9");
  assert.equal(getProductBySku("MISSING-000"), undefined);
});
