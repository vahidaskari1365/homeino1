// ============================================================
// PRICE PARSING — «۵۰،۰۰۰٬۰۰۰» در هر فرمتی باید درست خوانده شود.
//
// باگ واقعی کاربر: کادر هوش مصنوعی با کامای کیبورد فارسی («،» U+060C)
// عدد را در «۵۰» قطع می‌کرد و «،۰۰۰،۰۰۰» را دور می‌ریخت → max=50 تومان!
// این فایل قرارداد هر سه دروازهٔ قیمت را قفل می‌کند:
//   ۱) extractBudget (کادر AI + ایجنت خرید)
//   ۲) parseToman (پارامترهای /api/search و بودجهٔ استودیو)
//   ۳) normalizeAmount (نرمال‌سازی اینپوت تایپ‌شده)
// ============================================================
import { describe, expect, it } from "vitest";
import { extractBudget, toLatinDigits } from "@/services/agents/nlu";
import { normalizeAmount, parseToman } from "@/lib/utils";

describe("extractBudget — جداکننده‌های سه‌رقمی", () => {
  it("کامای کیبورد فارسی «،» (باگ اصلی) — «مبل زیر ۵۰،۰۰۰،۰۰۰ تومان»", () => {
    const b = extractBudget("مبل زیر ۵۰،۰۰۰،۰۰۰ تومان");
    expect(b).not.toBeNull();
    expect(b!.max).toBe(50_000_000);
  });

  it("کامای لاتین — «زیر 50,000,000»", () => {
    expect(extractBudget("زیر 50,000,000")!.max).toBe(50_000_000);
  });

  it("جداکنندهٔ هزارگان فارسی «٬» (U+066C) — «تا ۵٬۰۰۰٬۰۰۰ تومان»", () => {
    expect(extractBudget("تا ۵٬۰۰۰٬۰۰۰ تومان")!.max).toBe(5_000_000);
  });

  it("عدد لخت بدون جداکننده — «50000000»", () => {
    expect(extractBudget("50000000")!.min).toBe(40_000_000); // ±۲۰٪
    expect(extractBudget("50000000")!.max).toBe(60_000_000);
  });

  it("ارقام عربی با کامای فارسی — «زیر ٥٠،٠٠٠،٠٠٠»", () => {
    expect(extractBudget("زیر ٥٠،٠٠٠،٠٠٠")!.max).toBe(50_000_000);
  });

  it("بدون اینکه کاما، جمله را بشکند — «مبل، زیر ۳۰٬۰۰۰٬۰۰۰ تومان»", () => {
    expect(extractBudget("مبل، زیر ۳۰٬۰۰۰٬۰۰۰ تومان")!.max).toBe(30_000_000);
  });

  it("«بین X تا Y» با جداکننده", () => {
    const b = extractBudget("بین ۲۰،۰۰۰٬۰۰۰ تا ۴۰,000,000 تومان");
    expect(b!.min).toBe(20_000_000);
    expect(b!.max).toBe(40_000_000);
  });

  it("ضریب واژه‌ای هنوز کار می‌کند — «زیر ۵۰ میلیون»", () => {
    expect(extractBudget("زیر ۵۰ میلیون")!.max).toBe(50_000_000);
  });
});

describe("toLatinDigits", () => {
  it("ارقام فارسی و عربی را درست مپ می‌کند (بدون شیفت جدول)", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("٥٠")).toBe("50"); // باگ قبلی: «15»
  });
});

describe("parseToman — دروازهٔ پارامترهای API و بودجهٔ استودیو", () => {
  it("هر فرمت انسانی", () => {
    expect(parseToman("50,000,000")).toBe(50_000_000);
    expect(parseToman("۵۰٬۰۰۰٬۰۰۰")).toBe(50_000_000);
    expect(parseToman("۵۰،۰۰۰٬۰۰۰")).toBe(50_000_000);
    expect(parseToman(" ۵۰ ۰۰۰ ۰۰۰ ")).toBe(50_000_000);
  });

  it("ورودی غیرعددی → undefined (نه NaN) — مثل آیدی پریست «low»", () => {
    expect(parseToman("low")).toBeUndefined();
    expect(parseToman("")).toBeUndefined();
    expect(parseToman(null)).toBeUndefined();
    expect(parseToman("12abc34")).toBeUndefined();
  });

  it("صفر و منفی معنا ندارند → undefined (فیلتر بی‌صدا حذف می‌شود)", () => {
    expect(parseToman("0")).toBeUndefined();
  });
});

describe("normalizeAmount — اینپوت تایپ‌شده", () => {
  it("همهٔ جداکننده‌ها + هر دو الفبای رقم", () => {
    expect(normalizeAmount("۵۰،۰۰۰٬۰۰۰")).toBe("50000000");
    expect(normalizeAmount("50,000,000")).toBe("50000000");
    expect(normalizeAmount("٥٠٬٠٠٠")).toBe("50000");
  });
});
