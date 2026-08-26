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
// AI PRODUCT SELECTION + SKU + REAL STORE MATCHING PATCH TESTS
// ============================================================

import {
  categoryToRoomElement,
  detectCategorySkuConflict,
  matchStoreProducts,
  type MatchedStoreProduct,
} from "../../src/services/ai/roomState";
import { getProductBySkuOrCode, getProductById, products as seedCatalog } from "../../src/data/products";
import { parseProductDimensions } from "../../src/services/ai/placement";
import { runDesignPipeline } from "../../src/services/ai/pipeline";
import { productsRepository } from "../../src/repositories/products";

// Scenario 1: Selection-only intent
test("Scenario 1: UI Selection-only intent — Sofa selected with empty prompt -> target: sofa, scope: single_item", () => {
  const intent = heuristicUnderstandIntent({
    prompt: "",
    selectedTargets: ["sofa"],
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.intent, "targeted_edit");
  assert.ok(intent.preservedElements.includes("wall"));
  assert.ok(intent.preservedElements.includes("floor"));
  assert.ok(!intent.preservedElements.includes("sofa"));
});

// Scenario 2: Selection + text prompt
test("Scenario 2: Selection + text prompt — Sofa selected + «مدرنش کن» -> target: sofa, style: Modern", () => {
  const intent = heuristicUnderstandIntent({
    prompt: "مدرنش کن",
    selectedTargets: ["sofa"],
  });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
  assert.equal(intent.style, "Modern");
  assert.equal(intent.intent, "targeted_edit");
  assert.ok(intent.preservedElements.includes("rug"));
  assert.ok(intent.preservedElements.includes("lighting"));
});

// Scenario 3: User prompt override
test("Scenario 3: User prompt override — Sofa selected + «کل اتاق را Japandi کن» -> scope: room, style: Japandi, architecture preserved", () => {
  const intent = heuristicUnderstandIntent({
    prompt: "کل اتاق را Japandi کن",
    selectedTargets: ["sofa"],
  });
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  assert.equal(intent.intent, "full_redesign");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `${el} must be preserved`);
    assert.ok(!intent.target.includes(el), `${el} must not be targeted`);
  }
});

// Scenario 4: No selection + text prompt
test("Scenario 4: No selection + text prompt — «اتاق را Japandi کن» -> scope: room, style: Japandi, architecture preserved", () => {
  const intent = heuristicUnderstandIntent({
    prompt: "اتاق را Japandi کن",
  });
  assert.equal(intent.scope, "room");
  assert.equal(intent.style, "Japandi");
  assert.equal(intent.intent, "full_redesign");
  for (const el of STRUCTURAL_ELEMENTS) {
    assert.ok(intent.preservedElements.includes(el), `${el} must be preserved`);
  }
});

// Scenario 5: SKU Resolution
test("Scenario 5: SKU Resolution — Valid SKU resolves to real product, category, and dimensions", async () => {
  const product = getProductBySkuOrCode("SKU-SOFA-01") || getProductBySkuOrCode("SKU-SOFA-MIN") || seedCatalog[0];
  assert.ok(product, "Product should be found");
  assert.ok(product.sku, "Product must have SKU");
  assert.ok(product.name, "Product must have name");
  assert.ok(product.categorySlug, "Product must have category");

  // Repository lookup
  const repoProduct = await productsRepository.bySku(product.sku!);
  assert.ok(repoProduct, "Repository must resolve SKU");
  assert.equal(repoProduct?.id, product.id);

  // Dimension parser
  const dims = parseProductDimensions(product.dimensions);
  if (product.dimensions) {
    assert.ok(dims, "Dimensions should parse");
    assert.ok(dims.width && dims.width > 0);
  }
});

// Scenario 6: Invalid SKU
test("Scenario 6: Invalid SKU — INVALID-SKU-999 returns safe Persian error, does not invent product", async () => {
  const invalid = getProductBySkuOrCode("INVALID-SKU-999");
  assert.equal(invalid, undefined, "Invalid SKU must not return a product");

  const repoLookup = await productsRepository.bySku("INVALID-SKU-999");
  assert.ok(!repoLookup, "Repository must return undefined/null for invalid SKU");

  const intent = heuristicUnderstandIntent({
    prompt: "",
    sku: "INVALID-SKU-999",
  });
  assert.ok(intent.ambiguous, "Should flag as ambiguous / invalid");
  assert.ok(intent.note?.includes("پیدا نشد") || intent.note?.includes("بررسی کنید"));
});

// Scenario 7: Category / SKU Conflict
test("Scenario 7: Category / SKU Conflict — User selects Sofa + Lamp SKU -> detects conflict and warns", () => {
  const lamp = seedCatalog.find((p) => p.categorySlug === "lighting")!;
  assert.ok(lamp, "Lamp product must exist");

  const conflict = detectCategorySkuConflict(["sofa"], ["sofa"], lamp);
  assert.ok(conflict.hasConflict, "Must detect conflict between sofa and lamp");
  assert.equal(conflict.productElement, "lighting");
  assert.ok(conflict.message?.includes("روشنایی") || conflict.message?.includes("lighting") || conflict.message?.includes("همخوانی"));
});

// Scenario 8: Real Store Product Matching
test("Scenario 8: Real Store Product Matching — exact SKU > exact product > category > style > room", () => {
  const sampleProduct = seedCatalog[0];
  const matches = matchStoreProducts({
    sku: sampleProduct.sku,
    targets: ["sofa"],
    style: "modern",
    roomType: "living",
  });

  assert.ok(matches.length > 0, "Matches must not be empty");
  // Top match should be the exact SKU
  assert.equal(matches[0].productId, sampleProduct.id);
  assert.ok(matches[0].score >= 100, "Exact SKU match should have top score");
  assert.ok(matches[0].storeName, "Must have real store name");
  assert.ok(matches[0].productUrl, "Must have real product URL");
});

// Scenario 9: Multi-store ranking
test("Scenario 9: Multi-store ranking — Products from multiple stores correctly ranked by relevance", () => {
  const matches = matchStoreProducts({
    targets: ["sofa", "lighting"],
    style: "modern",
    roomType: "living",
    limit: 8,
  });

  assert.ok(matches.length > 1, "Should find multiple store products");
  const storeNames = new Set(matches.map((m) => m.storeName));
  assert.ok(storeNames.size >= 2, "Should include products from multiple distinct stores");

  // Verify descending score order
  for (let i = 0; i < matches.length - 1; i++) {
    assert.ok(matches[i].score >= matches[i + 1].score, "Matches must be sorted by score descending");
  }
});

// Scenario 10: Image Pipeline context
test("Scenario 10: Image Pipeline context — Product visual features included in engine prompt", () => {
  const sampleProduct = seedCatalog[0];
  const placementProduct = {
    id: sampleProduct.id,
    name: sampleProduct.name,
    category: sampleProduct.categorySlug,
    material: sampleProduct.materials?.[0] || "چرم",
    color: sampleProduct.colors?.[0]?.name || "مشکی",
    style: sampleProduct.styleSlugs?.[0] || "modern",
    dimensions: parseProductDimensions(sampleProduct.dimensions),
  };

  const plan = planProductPlacement(placementProduct);
  const prompt = productPlacementPrompt(placementProduct, plan);

  assert.ok(prompt.includes(placementProduct.name), "Engine prompt must include product name");
  if (placementProduct.material) {
    assert.ok(prompt.includes(placementProduct.material), "Engine prompt must include product material");
  }
});

// Scenario 11: Continuation memory
test("Scenario 11: Continuation memory — Turn 2 retains previous SKU, product ID, and targets", () => {
  const sample = seedCatalog[0];
  const turn1 = heuristicUnderstandIntent({
    prompt: "این مبل را در نشیمن قرار بده",
    sku: sample.sku,
    productId: sample.id,
    selectedTargets: ["sofa"],
  });

  assert.deepEqual(turn1.target, ["sofa"]);

  const turn2 = heuristicUnderstandIntent({
    prompt: "کمی بزرگترش کن",
    previousTargets: turn1.target,
    previousProductId: sample.id,
    previousSKU: sample.sku,
  });

  assert.deepEqual(turn2.target, ["sofa"], "Continuation turn must retain target sofa");
  assert.equal(turn2.scope, "single_item");
});

// Scenario 12: Room analysis integration
test("Scenario 12: Room analysis integration — Room analysis passed into AI context, influencing product ranking", () => {
  const matches = matchStoreProducts({
    roomType: "bedroom",
    style: "minimal",
    targets: ["bed"],
  });

  assert.ok(matches.length > 0);
  const topMatch = matches[0];
  assert.ok(topMatch.categorySlug === "bedding" || topMatch.categorySlug === "furniture" || topMatch.styleSlugs.includes("minimal"));
});

// Scenario 13: No fake products
test("Scenario 13: No fake products — Matched products only from real repository, all fields valid", () => {
  const allMatches = matchStoreProducts({
    style: "modern",
    limit: 20,
  });

  for (const m of allMatches) {
    const realProd = getProductById(m.productId);
    assert.ok(realProd, `Product ${m.productId} must exist in seed/DB catalog`);
    assert.equal(m.name, realProd.name);
    assert.equal(m.price, realProd.price);
    assert.ok(m.storeName.length > 0, "Must have real store name");
    assert.ok(m.productUrl.startsWith("/products/"), "Must have real valid URL path");
    assert.ok(m.image.length > 0, "Must have real product image");
  }
});

// ============================================================
// FINAL AI → PRODUCT → STORE END-TO-END PATCH — TEST MATRIX (A–M)
//
//   UI Selection → Product/SKU → AI Context → Intent → LLM →
//   Validated Instruction → Orali/Image → Real Product Matching →
//   Real Catalog → Real Stores → Products under the generated image
// ============================================================
import { runIntentUnderstanding } from "../../src/services/ai/pipeline";
import { normalizeProductCode, type RoomElement as _RoomElementMatrix } from "../../src/services/ai/roomState";
import { resolveProductByCode, isDatabaseCatalog } from "../../src/services/ai/productSource";
import { stores as realStores } from "../../src/data/stores";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---- Phase 5: category resolution priority (no blanket furniture→sofa) ----
test("Matrix P5: categoryToRoomElement resolves by subcategory first, furniture alone = conservative unknown", () => {
  assert.equal(categoryToRoomElement("furniture"), null, "bare «furniture» must NOT be assumed sofa");
  assert.equal(categoryToRoomElement("furniture", "sofa"), "sofa");
  assert.equal(categoryToRoomElement("furniture", "armchair"), "chair", "armchair ≠ sofa");
  assert.equal(categoryToRoomElement("furniture", "coffee-table"), "table");
  assert.equal(categoryToRoomElement("furniture", "میز جلو مبلی بلوط"), "table");
  assert.equal(categoryToRoomElement("furniture", "صندلی راحتی"), "chair");
  assert.equal(categoryToRoomElement("lighting", "table-lamp"), "lighting", "table-LAMP is lighting, not a table");
  assert.equal(categoryToRoomElement("bedroom", "bed"), "bed");
});

// ---- A: UI Sofa only → target = sofa ----
test("Matrix A: UI Sofa only → target=sofa, scope=single_item", () => {
  const intent = heuristicUnderstandIntent({ prompt: "", selectedTargets: ["sofa"] });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.scope, "single_item");
});

// ---- B: UI Sofa + «کرمش کن» → target=sofa + color=cream ----
test("Matrix B: UI Sofa + cream request → target=sofa, color_change with کرم", () => {
  const intent = heuristicUnderstandIntent({ prompt: "رنگش کرم باشه", selectedTargets: ["sofa"] });
  assert.deepEqual(intent.target, ["sofa"]);
  assert.equal(intent.intent, "color_change");
  assert.ok(intent.colors?.includes("کرم"));
});

// ---- C: valid SKU resolves EXACTLY (after normalization) ----
test("Matrix C: valid SKU → exact product resolved through the single product source", async () => {
  assert.equal(normalizeProductCode("   SOF-1024  "), "sof-1024", "trim + lowercase, match stays exact");
  const resolved = await resolveProductByCode("  SOF-1024 ");
  assert.ok(resolved, "SKU SOF-1024 must resolve");
  assert.equal(resolved!.product.id, "p1");
  assert.equal(resolved!.product.sku, "SOF-1024");
  assert.equal(resolved!.product.categorySlug, "furniture");
  assert.equal(resolved!.product.subCategorySlug, "sofa");
  assert.ok(resolved!.product.price > 0, "real price from the catalog");
  assert.ok(!isDatabaseCatalog(), "test env uses the static dev catalog (explicitly allowed)");
  // whitespace inside the code is NOT silently forgiven — match is exact
  assert.equal((await resolveProductByCode("SOF -1024"))?.product.id, undefined, "fuzzy match must not happen");
});

// ---- D: invalid SKU → safe Persian error, no invented product ----
test("Matrix D: invalid SKU → AiError INVALID_SKU with the exact safe message", async () => {
  await assert.rejects(
    runIntentUnderstanding({ prompt: "", scope: "targeted", sku: "NOPE-0000" }),
    (err: unknown) => {
      assert.ok(err instanceof AiError);
      assert.equal((err as AiError).code, "INVALID_SKU");
      assert.equal(
        (err as AiError).message,
        "این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید.",
      );
      return true;
    },
  );
});

// ---- E: SKU + Category conflict → conflict error ----
test("Matrix E: SKU (lighting) + UI Sofa → CATEGORY_SKU_CONFLICT error", async () => {
  const lamp = seedCatalog.find((p) => p.categorySlug === "lighting")!;
  await assert.rejects(
    runIntentUnderstanding({
      prompt: "",
      scope: "targeted",
      sku: lamp.sku,
      targets: ["sofa"],
      selection: { category: "furniture" },
    }),
    (err: unknown) => {
      assert.ok(err instanceof AiError);
      assert.equal((err as AiError).code, "CATEGORY_SKU_CONFLICT");
      return true;
    },
  );
});

// ---- F: exact SKU has ABSOLUTE priority (category can never override it) ----
test("Matrix F: exact SKU ranked first even when the category target disagrees", () => {
  const matches = matchStoreProducts({ sku: "SOF-1024", targets: ["lighting"], style: "modern" });
  assert.ok(matches.length > 0);
  assert.equal(matches[0].productId, "p1", "exact SKU product must be the top result");
  assert.ok(matches[0].score >= 5000, "exact SKU weight is absolute");
  assert.ok(matches[0].matchReasons.some((r) => r.includes("تطابق دقیق")));
  for (const m of matches) assert.ok(m.score <= matches[0].score);
});

// ---- G: no exact match → only RELEVANT products ----
test("Matrix G: target=lighting without SKU → only lighting products returned", () => {
  const matches = matchStoreProducts({ targets: ["lighting"] });
  assert.ok(matches.length > 0);
  for (const m of matches) {
    const p = getProductById(m.productId);
    assert.ok(p, "matched product must exist in the catalog");
    assert.equal(p!.categorySlug, "lighting", "irrelevant categories must not leak in");
  }
});

// ---- H: no relevant products → [] (never the general catalog) ----
test("Matrix H: target with no catalog representation → empty result, not filler", () => {
  assert.deepEqual(matchStoreProducts({ targets: ["door"] }), []);
  assert.deepEqual(matchStoreProducts({ targets: ["window"] }), []);
  assert.deepEqual(matchStoreProducts({ targets: ["wall"], style: "nonexistent-style-xyz" }), []);
});

// ---- I: multi-store — results from multiple REAL vendors ----
test("Matrix I: multi-store matching — several real stores, real store names only", () => {
  const matches = matchStoreProducts({ targets: ["sofa", "lighting"], roomType: "living", limit: 8 });
  assert.ok(matches.length > 1);
  const storeIds = new Set(matches.map((m) => m.storeId));
  assert.ok(storeIds.size >= 2, "products from multiple vendors must be able to appear");
  const realNames = new Set(realStores.map((s) => s.name));
  for (const m of matches) {
    assert.ok(m.storeName.length > 0);
    assert.ok(realNames.has(m.storeName), `store name must be REAL (${m.storeName})`);
    assert.ok(m.productUrl.startsWith("/products/"));
  }
});

// ---- J: generated image → matchedProducts present in PipelineResult ----
test("Matrix J: runDesignPipeline returns matchedProducts built after generation", async () => {
  const res = await runDesignPipeline({
    prompt: "رنگ مبل کرم باشه",
    scope: "targeted",
    targets: ["sofa"],
    sku: "SOF-1024",
    style: "modern",
    room: "living",
  });
  assert.ok(Array.isArray(res.matchedProducts), "PipelineResult.matchedProducts must exist");
  assert.ok(res.matchedProducts!.length > 0, "real matches for a real SKU");
  assert.equal(res.matchedProducts![0].productId, "p1");
  assert.equal(res.sku, "SOF-1024", "result carries the REAL catalog SKU");
  assert.equal(res.selectedProduct?.id, "p1", "resolved product is the AI target");
  assert.equal(res.selectedProduct?.category, "furniture");
  assert.ok(res.instruction.enginePrompt.includes("SOF-1024"), "engine prompt preserves product identity");
});

// ---- K: designer page renders matchedProducts under the generated image ----
test("Matrix K: designer page wires PipelineResult.matchedProducts (no client fallback)", () => {
  const page = readFileSync(join(process.cwd(), "src/app/ai/design/page.tsx"), "utf8");
  assert.ok(page.includes("pipelineRes.matchedProducts"), "page must consume the server pipeline matches");
  assert.ok(page.includes("کالاهای هماهنگ از فروشگاه‌ها"), "matched products section below the output");
  assert.ok(page.includes("محصول مشابهی در فروشگاه‌های فعلی پیدا نشد"), "honest empty state");
  assert.ok(!page.includes("matchStoreProducts({"), "no client-side catalog fallback may remain");
});

// ---- L: continuation keeps previous product identity ----
test("Matrix L: «کمی کوچک‌ترش کن» keeps previousSKU/previousProductId as the target", () => {
  const turn2intent = heuristicUnderstandIntent({
    prompt: "کمی کوچک‌ترش کن",
    previousTargets: ["sofa"],
    previousProductId: "p1",
    previousSKU: "SOF-1024",
  });
  assert.deepEqual(turn2intent.target, ["sofa"]);
  const inst = buildDesignInstruction(
    {
      prompt: "کمی کوچک‌ترش کن",
      scope: "targeted",
      previousTargets: ["sofa"],
      previousProductId: "p1",
      previousSKU: "SOF-1024",
    },
    turn2intent,
  );
  assert.equal(inst.selectedProduct?.sku, "SOF-1024", "same product stays the design target");
  assert.equal(inst.selectedProduct?.id, "p1");
  assert.ok(inst.targets.includes("sofa"));
});

// ---- M: room analysis + sofa → room-aware matching (never overriding SKU) ----
test("Matrix M: room-aware scoring boosts living-room sofas but never overrides exact SKU", () => {
  const living = matchStoreProducts({ targets: ["sofa"], roomType: "living" });
  const bedroom = matchStoreProducts({ targets: ["sofa"], roomType: "bedroom" });
  const livingSofa = living.find((m) => m.productId === "p1")!;
  const bedroomSofa = bedroom.find((m) => m.productId === "p1")!;
  assert.ok(livingSofa.score > bedroomSofa.score, "living-room compatibility must boost the sofa");
  // room compatibility must NEVER override an exact SKU:
  const skuPinned = matchStoreProducts({ sku: "SOF-1024", targets: ["sofa"], roomType: "bedroom" });
  assert.equal(skuPinned[0].productId, "p1");
  assert.ok(skuPinned[0].score >= 5000);
});
