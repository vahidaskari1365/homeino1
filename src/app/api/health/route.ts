import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { resolveGeminiConfig } from "@/services/ai/settings";

// ============================================================
// GET /api/health — تشخیص صادقانه برای مانیتورینگ و دیباگ.
//   ok = دیتابیس وصل است (لاگین/سفارش/اعتبار زنده‌اند)
//   checks.db: "ok" | "not-configured" | "unreachable"
//   checks.ai: موتور تصویر فعال — بدون افشای هیچ کلیدی
// پروداکشن Vercel 2026-09-09: ok:false با db:"not-configured" یعنی
// DATABASE_URL در Vercel ست نشده (ریشه قرمزی health).
// ============================================================

export const dynamic = "force-dynamic";

async function activeImageEngine(): Promise<string> {
  // کلید Gemini از پنل ادمین (DB) یا env — settings.ts سقوط نرم دارد
  if ((await resolveGeminiConfig()).apiKey) return "gemini";
  if (process.env.ZAI_API_BASE_URL || process.env.GLM_API_BASE_URL || process.env.ORALI_API_BASE_URL) return "zai";
  if (process.env.LLM_API_BASE_URL && process.env.LLM_API_KEY) return "openai-chat";
  if (process.env.FREELLMAPI_API_KEY && process.env.FREELLMAPI_BASE_URL) return "freellmapi";
  return "mock"; // بدون موتور واقعی → تولید عکس با Pollinations، ویرایش preview
}

export async function GET() {
  const ts = new Date().toISOString();

  if (!process.env.DATABASE_URL) {
    return Response.json(
      { ok: false, ts, checks: { db: "not-configured", ai: await activeImageEngine() }, hint: "DATABASE_URL در محیط ست نشده — در Vercel → Settings → Environment Variables اضافه شود" },
      { status: 503 },
    );
  }

  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, ts, checks: { db: "ok", ai: await activeImageEngine() } });
  } catch (err) {
    return Response.json(
      { ok: false, ts, checks: { db: "unreachable", ai: await activeImageEngine() }, hint: "DATABASE_URL ست شده اما اتصال ناموفق — pooler/پسورد/IP allowlist را چک کنید", detail: err instanceof Error ? err.message.slice(0, 160) : "unknown" },
      { status: 503 },
    );
  }
}
