// ============================================================
// تست دیکشنری آفلاین ترجمه (Task 42) — دو باگ واقعی پروداکشن:
//  (۱) PERSIAN_RE بدون /g فقط اولین حرف فارسی را حذف می‌کرد
//      → «دکوراسیون» به «کوراسیون» تبدیل می‌شد؛
//  (۲) الگوی /در/ داخل «مدرن» match می‌شد → «مدرن» به «door» می‌شد.
// قرارداد: خروجی دیکشنری هرگز نباید حرف فارسی داشته باشد.
// ============================================================
import { describe, expect, it } from "vitest";
import { dictionaryTranslate, hasPersian } from "./engineTranslate";

describe("دیکتنری آفلاین ترجمه — باگ‌های پروداکشن Task 42", () => {
  it("«مدرن» دیگر به door تبدیل نمی‌شود (باگ /در/ داخل مدرن)", () => {
    const out = dictionaryTranslate("مدرن دکوراسیون داخلی");
    expect(out).toContain("modern");
    expect(out).toContain("decor");
    expect(out).not.toContain("door");
    expect(hasPersian(out)).toBe(false);
  });

  it("حذف حروف فارسی کامل است نه فقط اولین حرف (باگ بدون /g)", () => {
    const out = dictionaryTranslate("لوکس دکوراسیون داخلی");
    expect(out).toContain("luxury");
    expect(hasPersian(out)).toBe(false);
    expect(out).not.toContain("کوراسیون");
  });

  it("ترکیب کامل سبک + فضا: پذیرایی لوکس مدرن", () => {
    const out = dictionaryTranslate("پذیرایی لوکس مدرن");
    expect(out).toContain("living room");
    expect(out).toContain("luxury");
    expect(out).toContain("modern");
    expect(hasPersian(out)).toBe(false);
  });

  it("«در» مستقل همچنان door می‌شود", () => {
    const out = dictionaryTranslate("در چوبی بگذار");
    expect(out).toContain("door");
    expect(out).toContain("wooden");
  });

  it("ورودی فارسی بی‌قاعده → پیش‌فرض دامنه", () => {
    expect(dictionaryTranslate("غنچغنچ پلنگپلنگ")).toBe("interior design edit");
  });
});
