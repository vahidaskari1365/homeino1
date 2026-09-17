// ============================================================
// تست گارد دامنه و وفاداری (Task 42) — خواسته مالک: پرامپت ثابت پشت
// تولید عکس که خروجی همیشه با دکوراسیون داخلی هم‌راستا و واقع‌گرا باشد.
// قرارداد: بدون شبکه، بدون env — فقط رشته‌ها.
// ============================================================
import { describe, expect, it } from "vitest";
import {
  DOMAIN_ANCHOR,
  FIDELITY_ANCHOR,
  EDIT_FIDELITY_ANCHOR,
  buildGenerationPrompt,
} from "./domainGuard";

describe("گارد دامنه — buildGenerationPrompt", () => {
  it("لنگر دامنه همیشه اول می‌آید حتی با ورودی خالی", () => {
    const p = buildGenerationPrompt({});
    expect(p.startsWith(DOMAIN_ANCHOR)).toBe(true);
    expect(p.length).toBeGreaterThan(20);
  });

  it("لنگر وفاداری همیشه انتهای پرامپت است (واقع‌گرایی + فقط عناصر خواسته‌شده)", () => {
    const p = buildGenerationPrompt({ prompt: "modern gray sofa" });
    expect(p.endsWith(FIDELITY_ANCHOR)).toBe(true);
    expect(p).toContain("Photorealistic");
    expect(p).toContain("do not invent unrelated objects");
  });

  it("همه فیلدهای ترجمه‌شده با برچسب وارد پرامپت می‌شوند", () => {
    const p = buildGenerationPrompt({
      prompt: "cozy reading corner",
      style: "minimal",
      room: "living room",
      color: "sage green",
      mood: "calm",
    });
    expect(p).toContain("cozy reading corner");
    expect(p).toContain("Decor style: minimal");
    expect(p).toContain("Room type: living room");
    expect(p).toContain("Color palette: sage green");
    expect(p).toContain("Mood: calm");
  });

  it("فیلد خالی/غایب هیچ برچسبی از خودش باقی نمی‌گذارد", () => {
    const p = buildGenerationPrompt({ prompt: "wooden bed", style: "", room: undefined });
    expect(p).not.toContain("Decor style");
    expect(p).not.toContain("Room type");
  });

  it("لنگر ویرایش عکس، حفظ معماری و تغییرِ فقط خواسته‌شده را قفل می‌کند", () => {
    expect(EDIT_FIDELITY_ANCHOR).toContain("Preserve the original room architecture");
    expect(EDIT_FIDELITY_ANCHOR).toContain("change ONLY what the user explicitly selected");
  });
});
