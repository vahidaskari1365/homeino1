// ============================================================
// AI SETTINGS (SERVER-ONLY) — تنظیمات موتورهای AI از پنل ادمین.
//
// هدف: ادمین بدون دست‌زدن به env های Vercel بتواند کلید و مدل‌های
// Google AI (Gemini) را از «پنل مدیریت → موتورهای AI» مدیریت کند.
//
// ذخیره‌سازی: جدول `system_settings` (jsonb) با کلیدهایی مثل `ai.gemini`.
// مقدار api_key با AES-256-GCM رمزنگاری می‌شود — در DB هرگز
// کلیدِ خام ذخیره نمی‌شود و از API ادمین هم فقط پیشوند برگردانده می‌شود.
//
// اولویت resolve (admin > env):
//   1. DB  (اگر ذخیره شده و enabled باشد)
//   2. env (GEMINI_API_KEY / GEMINI_TEXT_MODEL / GEMINI_IMAGE_MODEL)
//   3. هیچ — زنجیره به fallback خودش می‌رود (pollinations/mock)
//
// سقوط نرم: DB که تنظیم نباشد (مثل Vercel فعلی بدون DATABASE_URL)
// هیچ‌وقت throw نمی‌کند — به env برمی‌گردیم تا سایت همیشه بالا بماند.
// ============================================================
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";

const SETTING_KEY = "ai.gemini";

export interface GeminiSettings {
  apiKeyEnc: string; // رمزنگاری‌شده — هرگز به کلاینت نمی‌رود
  enabled: boolean;
  textModel: string | null;
  imageModel: string | null;
}

export interface GeminiRuntimeConfig {
  apiKey: string | null;
  textModel: string;
  imageModel: string;
  /** "db" = از پنل ادمین · "env" = متغیر محیطی · null = تنظیم نشده */
  source: "db" | "env" | null;
  enabled: boolean;
}

// ۲۰۲۶-۰۹: گوگل مدل‌های 2.5 را برای کاربران جدید بازنشسته کرده —
// نسل فعلی: gemini-3.6-flash (متن) و gemini-3.1-flash-image (Nano Banana 2).
// ادمین می‌تواند از پنل مدل دیگری (مثل gemini-3-pro-image) ست کند.
export const DEFAULT_TEXT_MODEL = "gemini-3.6-flash";
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

// ------------------------------------------------------------
// رمزنگاری — AES-256-GCM. کلید از APP_SECRET / AI_SETTINGS_SECRET /
// DATABASE_URL مشتق می‌شود؛ اگر هیچ‌کدام نباشد یک کلید توسعه‌ای
// ثابت استفاده می‌شود (صادقانه مستند می‌شود: در پروداکشن APP_SECRET
// را ست کنید). تغییر کلید رمز ⇒ مقدار قدیمی خوانده نمی‌شود ⇒ ادمین
// باید دوباره ذخیره کند (سقوط نرم، بدون کرش).
// ------------------------------------------------------------
function encKey(): Buffer {
  const raw =
    process.env.AI_SETTINGS_SECRET ||
    process.env.APP_SECRET ||
    process.env.DATABASE_URL ||
    "homeino-local-development-secret";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const [v, ivB64, tagB64, dataB64] = payload.split(".");
    if (v !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // کلید رمز عوض شده یا مقدار خراب — مثل «تنظیم‌نشده» رفتار می‌کنیم
  }
}

/** پیشوند امن برای نمایش در ادمین — کلید کامل هرگز به کلاینت نمی‌رود. */
export function maskKey(plain: string): string {
  if (plain.length <= 10) return "••••••••";
  return `${plain.slice(0, 6)}…${plain.slice(-4)}`;
}

// ------------------------------------------------------------
// لایه DB — همیشه سقوط نرم؛ DB تنظیم نباشد = null/false.
// ------------------------------------------------------------
async function readRow(): Promise<GeminiSettings | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, SETTING_KEY)).limit(1);
    if (!row) return null;
    const v = (row.value ?? {}) as Partial<GeminiSettings>;
    if (!v.apiKeyEnc) return null;
    return {
      apiKeyEnc: String(v.apiKeyEnc),
      enabled: v.enabled !== false,
      textModel: typeof v.textModel === "string" && v.textModel.trim() ? v.textModel.trim() : null,
      imageModel: typeof v.imageModel === "string" && v.imageModel.trim() ? v.imageModel.trim() : null,
    };
  } catch {
    return null;
  }
}

export async function getGeminiSettings(): Promise<Omit<GeminiSettings, "apiKeyEnc"> & { apiKeyMask: string | null; updatedAt: Date | null; hasKey: boolean } | null> {
  const row = await readRow();
  if (!row) return null;
  const plain = decryptSecret(row.apiKeyEnc);
  return {
    hasKey: Boolean(plain),
    apiKeyMask: plain ? maskKey(plain) : null,
    enabled: row.enabled,
    textModel: row.textModel,
    imageModel: row.imageModel,
    updatedAt: null,
  };
}

export async function saveGeminiSettings(input: {
  apiKey?: string | null; // null/undefined = کلید فعلی دست‌نخورده
  enabled?: boolean;
  textModel?: string | null;
  imageModel?: string | null;
  updatedBy?: string | null;
}): Promise<{ saved: boolean; reason?: string }> {
  try {
    const prev = await readRow();
    let apiKeyEnc = prev?.apiKeyEnc ?? "";
    if (input.apiKey != null && input.apiKey.trim()) {
      const key = input.apiKey.trim();
      // کلید کلاسیک با AIza شروع می‌شود؛ کلیدهای جدید AI Studio (۲۰۲۶) با AQ.
      if (!/^(?:AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{30,})$/.test(key))
        return { saved: false, reason: "قالب کلید گوگل معتبر نیست (باید با AIza یا AQ. شروع شود)" };
      apiKeyEnc = encryptSecret(key);
    }
    if (!apiKeyEnc) return { saved: false, reason: "هیچ کلیدی برای ذخیره وجود ندارد — ابتدا کلید را وارد کنید" };
    const value = {
      apiKeyEnc,
      enabled: input.enabled ?? prev?.enabled ?? true,
      textModel: input.textModel?.trim() || prev?.textModel || null,
      imageModel: input.imageModel?.trim() || prev?.imageModel || null,
    };
    const db = getDb();
    await db
      .insert(systemSettings)
      .values({ key: SETTING_KEY, value, updatedBy: input.updatedBy ?? null, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedBy: input.updatedBy ?? null, updatedAt: new Date() } });
    invalidateCache();
    return { saved: true };
  } catch (err) {
    return { saved: false, reason: err instanceof Error && /DATABASE_URL/.test(err.message) ? "DATABASE_URL تنظیم نیست — کلید در DB ذخیره نمی‌شود" : "ذخیره در دیتابیس ناموفق بود" };
  }
}

// ------------------------------------------------------------
// resolve — نقطه‌ی واحد مصرف در provider/llm/status/health.
// کش ۱۵ ثانیه‌ای برای جلوگیری از ضربه به DB در هر درخواست.
// ------------------------------------------------------------
let cache: { value: GeminiRuntimeConfig; until: number } | null = null;

export function invalidateCache(): void {
  cache = null;
}

function envConfig(): GeminiRuntimeConfig {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim() || null;
  return {
    apiKey,
    textModel: (process.env.GEMINI_TEXT_MODEL || "").trim() || DEFAULT_TEXT_MODEL,
    imageModel: (process.env.GEMINI_IMAGE_MODEL || "").trim() || DEFAULT_IMAGE_MODEL,
    source: apiKey ? "env" : null,
    enabled: true,
  };
}

export async function resolveGeminiConfig(): Promise<GeminiRuntimeConfig> {
  // در تست‌ها کش نمی‌کنیم — vi.stubEnv باید فوراً اثر کند
  const ttl = process.env.NODE_ENV === "test" ? 0 : 15_000;
  const now = Date.now();
  if (ttl > 0 && cache && cache.until > now) return cache.value;

  const env = envConfig();
  let value: GeminiRuntimeConfig = env;
  const row = await readRow();
  if (row) {
    const plain = decryptSecret(row.apiKeyEnc);
    if (row.enabled && plain) {
      value = {
        apiKey: plain,
        // مدل ادمین > مدل env > پیش‌فرض
        textModel: row.textModel || env.textModel,
        imageModel: row.imageModel || env.imageModel,
        source: "db",
        enabled: true,
      };
    } else if (row.enabled === false && env.apiKey) {
      // ادمین عمداً خاموش کرده — به env نمی‌رویم، صادقانه خاموش است
      value = { ...env, apiKey: null, source: null, enabled: false };
    }
  }

  cache = { value, until: now + ttl };
  return value;
}
