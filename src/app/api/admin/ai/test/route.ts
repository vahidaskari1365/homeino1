// ============================================================
// /api/admin/ai/test — تست اتصال موتور AI از پنل ادمین (admin)
//
// POST { provider: "gemini", apiKey?, imageModel? }
//   · اگر apiKey داده شود همان تست می‌شود (تست قبل از ذخیره)
//   · وگرنه کلید ذخیره‌شده/محیطی استفاده می‌شود
// تست = ListModels روی generativelanguage.googleapis.com —
// رایگان است، هیچ توکنی مصرف نمی‌کند و صادقانه ok/خطا برمی‌گرداند.
// کلید کامل هیچ‌وقت در پاسخ برنمی‌گردد.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { resolveGeminiConfig } from "@/services/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const POST = guard(async (req) => {
  await requireAdminUser(req);
  const body = (await readBody(req, 10_000)) as Record<string, unknown>;
  const provider = String(body.provider ?? "gemini");
  if (provider !== "gemini") throw ApiError.badRequest("الان فقط provider=gemini پشتیبانی می‌شود");

  const inlineKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (inlineKey && !inlineKey.startsWith("AIza")) {
    return ok({ ok: false, provider, error: "قالب کلید معتبر نیست — کلید Google با AIza شروع می‌شود" });
  }

  const cfg = await resolveGeminiConfig();
  const key = inlineKey || cfg.apiKey;
  if (!key) {
    return ok({ ok: false, provider, error: "کلیدی تنظیم نشده — ابتدا کلید AI Studio را ذخیره کنید" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API}?pageSize=200&key=${encodeURIComponent(key)}`, { signal: controller.signal });
    if (!res.ok) {
      const status = res.status;
      const detail =
        status === 400 ? "کلید نامعتبر است (API_KEY_INVALID)" :
        status === 403 ? "کلید معتبر نیست یا دسترسی Generative Language API ندارد" :
        status === 429 ? "سقف درخواست موقتاً پر شده — بعداً تست کنید" :
        "خطای گوگل";
      return ok({ ok: false, provider, error: `${detail} (HTTP ${status})` });
    }
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const models = (data.models ?? []).map((m) => (m.name ?? "").replace("models/", ""));
    const hasText = models.some((m) => m.startsWith("gemini-2.5-flash") || m.startsWith("gemini-flash"));
    const hasImage = models.includes(cfg.imageModel) || models.some((m) => m.includes("flash-image") || m.includes("nano-banana"));
    return ok({
      ok: true,
      provider,
      keySource: inlineKey ? "inline" : cfg.source,
      modelsCount: models.length,
      textModelReady: hasText,
      imageModelReady: hasImage,
      imageModel: cfg.imageModel,
      note: hasImage ? "تولید و ویرایش عکس (Nano Banana) فعال است" : "متن فعال است؛ مدل عکس در لیست این کلید دیده نشد",
    });
  } catch (err) {
    const aborted = (err as { name?: string })?.name === "AbortError";
    return ok({ ok: false, provider, error: aborted ? "تایم‌اوت اتصال به گوگل" : "اتصال به گوگل ناموفق بود" });
  } finally {
    clearTimeout(timeout);
  }
});
