// تست‌های سرویس تنظیمات AI — امنیت کلید و سقوط نرم (بدون DB).
// قانون طلایی session قبلی: اول تست، بعد اطمینان — همین الگو ادامه دارد.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptSecret, decryptSecret, maskKey, resolveGeminiConfig, invalidateCache, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from "./settings";

const ORIGINAL_ENV = { ...process.env };

function clearGeminiEnv() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_TEXT_MODEL;
  delete process.env.GEMINI_IMAGE_MODEL;
  delete process.env.DATABASE_URL;
  delete process.env.AI_SETTINGS_SECRET;
  delete process.env.APP_SECRET;
}

beforeEach(() => {
  clearGeminiEnv();
  vi.stubEnv("NODE_ENV", "test");
  invalidateCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  invalidateCache();
});

describe("encryptSecret / decryptSecret", () => {
  it("چرخه کامل رمزنگاری — متن اصلی برگردانده می‌شود", () => {
    const key = "AIzaSyD-test-key-1234567890abcdef";
    const enc = encryptSecret(key);
    expect(enc).not.toContain(key); // خام در سطر رمز نیست
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc)).toBe(key);
  });

  it("مقدار دست‌کاری‌شده → null (نه throw)", () => {
    expect(decryptSecret("v1.aaaa.bbbb.cccc")).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
  });

  it("کلید رمز متفاوت → خواندن ناموفق و null", () => {
    const enc = encryptSecret("AIza-secret");
    process.env.AI_SETTINGS_SECRET = "changed-secret";
    expect(decryptSecret(enc)).toBeNull();
  });
});

describe("maskKey", () => {
  it("هرگز کلید کامل برنمی‌گرداند", () => {
    const key = "AIzaSyD1234567890abcdefghij";
    const masked = maskKey(key);
    expect(masked).toBe("AIzaSy…ghij");
    expect(masked).not.toContain("1234567890");
  });
});

describe("resolveGeminiConfig — بدون DB (مثل Vercel فعلی)", () => {
  it("بدون هیچ env → apiKey null و source null", async () => {
    const cfg = await resolveGeminiConfig();
    expect(cfg.apiKey).toBeNull();
    expect(cfg.source).toBeNull();
    expect(cfg.textModel).toBe(DEFAULT_TEXT_MODEL);
    expect(cfg.imageModel).toBe(DEFAULT_IMAGE_MODEL);
  });

  it("با GEMINI_API_KEY در env → source env و کلید برگردانده می‌شود", async () => {
    process.env.GEMINI_API_KEY = "AIzaSyD-test-key-1234567890abcdef";
    const cfg = await resolveGeminiConfig();
    expect(cfg.apiKey).toBe("AIzaSyD-test-key-1234567890abcdef");
    expect(cfg.source).toBe("env");
  });

  it("مدل‌های سفارشی env → رعایت می‌شود", async () => {
    process.env.GEMINI_API_KEY = "AIzaSyD-test-key-1234567890abcdef";
    process.env.GEMINI_TEXT_MODEL = "gemma-3-27b-it";
    process.env.GEMINI_IMAGE_MODEL = "imagen-4.0-generate-001";
    const cfg = await resolveGeminiConfig();
    expect(cfg.textModel).toBe("gemma-3-27b-it");
    expect(cfg.imageModel).toBe("imagen-4.0-generate-001");
  });
});
