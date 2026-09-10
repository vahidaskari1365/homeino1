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
  // کلید کلاسیک: AIza… · کلیدهای جدید AI Studio (۲۰۲۶): AQ.…
  if (inlineKey && !/^(?:AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{30,})$/.test(inlineKey)) {
    return ok({ ok: false, provider, error: "قالب کلید معتبر نیست — کلید Google با AIza یا AQ. شروع می‌شود" });
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
      let detail = "خطای گوگل";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        const msg = body.error?.message ?? "";
        if (/location is not supported/i.test(msg))
          detail = "منطقه‌ی سرور فعلی توسط Gemini API پشتیبانی نمی‌شود (location block) — روی Vercel مشکلی نیست";
        else if (/API_KEY_INVALID|api key not valid/i.test(msg)) detail = "کلید نامعتبر است (API_KEY_INVALID)";
        else if (status === 403) detail = "کلید معتبر نیست یا دسترسی Generative Language API ندارد";
        else if (status === 429) detail = "سقف درخواست موقتاً پر شده — بعداً تست کنید";
      } catch {
        /* بدنه‌ی خطا خوانده نشد — همان «خطای گوگل» */
      }
      return ok({ ok: false, provider, error: `${detail} (HTTP ${status})` });
    }
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const models = (data.models ?? []).map((m) => (m.name ?? "").replace("models/", ""));
    // متن: هر Gemini فلشِ بدون تصویر — نسل 2.5/3.x/4 و آینده
    const hasText = models.some((m) => /^gemini-\d/.test(m) && m.includes("flash") && !m.includes("image"));
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
