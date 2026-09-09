// ============================================================
// تست طلایی زنجیره تصویر — اقتباس از مهارت ai-regression-testing (ECC v2.2.1)
//
// باگی که این تست قفل می‌کند (یافت‌شده در پروداکشن Vercel 2026-09-09):
//   وقتی هیچ کلید موتوری ست نشده، resolveProvider همیشه mock می‌دهد و
//   mock هرگز خطا نمی‌پراند — پس زنجیره نظری «خطا → pollinations → mock»
//   هرگز فعال نمی‌شد و «تولید عکس» همیشه عکس استوک pexels می‌داد
//   (سبز-کاذب) و «ویرایش» پیش‌نمایش قلابی.
//
// قرارداد: بدون شبکه، بدون کلید — فقط ترتیب dispatch و رفتار contract.
// ============================================================
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { imageDispatchPlan, resolveProvider, resolveFreeGenerationFallback } from "./provider";

// Hoisted mocks — provider.ts این‌ها را در import-time استفاده می‌کند،
// پس mock باید قبل از import اعمال شود (در beforeEach دیر است).
// فایل .z-ai-config سندباکس/سلف‌هاست نباید نتیجه را عوض کند —
// تست باید رفتار پروداکشن Vercel (بدون فایل) را قفل کند.
vi.mock("./engineConfig", () => ({ isZEngineConfigured: () => false, engineConfig: () => null }));
vi.mock("./llm/openaiCompatLlm", () => ({ isOpenAiCompatConfigured: () => false }));

/** همه کلیدهایی که موتور واقعی را فعال می‌کنند — برای شبیه‌سازی «بدون کلید». */
const KEY_ENVS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "LLM_API_BASE_URL",
  "LLM_API_KEY",
  "FREELLMAPI_API_KEY",
  "FREELLMAPI_BASE_URL",
  "ZAI_API_BASE_URL",
  "ZAI_API_KEY",
  "GLM_API_BASE_URL",
  "GLM_API_KEY",
  "ORALI_API_BASE_URL",
  "ORALI_API_KEY",
];

describe("زنجیره تصویر بدون کلید (باگ: تولید عکس همیشه mock بود)", () => {
  it("تست طلایی — generate با primary=mock باید pollinations را قبل از mock امتحان کند", () => {
    // قبل از فیکس: imageDispatchPlan وجود نداشت و route مستقیم mock را dispatch
    // می‌کرد که هرگز fail نمی‌شود → pollinations مرده بود.
    expect(imageDispatchPlan("generate", "mock")).toEqual(["pollinations", "mock"]);
  });

  it("edit با primary=mock فقط mock صادقانه است (pollinations ویرایش ندارد)", () => {
    expect(imageDispatchPlan("edit", "mock")).toEqual(["mock"]);
    expect(imageDispatchPlan("inpaint", "mock")).toEqual(["mock"]);
  });

  it("موتور واقعی اول، بعد رایگان، بعد mock — برای generate", () => {
    expect(imageDispatchPlan("generate", "gemini")).toEqual(["gemini", "pollinations", "mock"]);
    expect(imageDispatchPlan("generate", "zai")).toEqual(["zai", "pollinations", "mock"]);
  });

  it("موتور واقعی اول، بعد mock — برای edit (مرحله رایگان حذف می‌شود)", () => {
    expect(imageDispatchPlan("edit", "gemini")).toEqual(["gemini", "mock"]);
    expect(imageDispatchPlan("inpaint", "zai")).toEqual(["zai", "mock"]);
  });
});

describe("مسیر کاهش صادقانه بدون هیچ env کلیدی (الگوی تست ۴ چک‌لیست)", () => {
  beforeEach(() => {
    for (const k of KEY_ENVS) vi.stubEnv(k, "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolveProvider بدون کلید → mock (صادقانه، نه موتور قلابی)", async () => {
    const { name } = await resolveProvider();
    expect(name).toBe("mock");
  });

  it("fallback کلید-کمتر generate موجود است و ویرایش ندارد (قرارداد)", async () => {
    const free = await resolveFreeGenerationFallback();
    expect(free).toBeTruthy();
    // قرارداد: pollinations فقط تولید می‌کند — ویرایش باید reject شود تا
    // مسیر صادقانه mock (با فلگ preview) اجرا شود، نه ادعای ویرایش قلابی.
    await expect(free!.editImage({} as never)).rejects.toThrow();
    await expect(free!.inpaint({} as never)).rejects.toThrow();
  });
});
