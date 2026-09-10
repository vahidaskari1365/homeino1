// ============================================================
// /api/admin/ai/settings — مدیریت موتورهای AI از پنل ادمین (admin)
//
//   GET  → وضعیت فعلی (کلید فقط به‌صورت ماسک‌شده — هرگز کامل برنمی‌گردد)
//   PUT  { apiKey?, enabled?, textModel?, imageModel? }
//        · apiKey جدید باید با AIza شروع شود (کلید Google AI Studio)
//        · apiKey خالی/ناموجد = کلید فعلی دست‌نخورده
// ذخیره در system_settings با AES-256-GCM — در DB کلید خام ذخیره نمی‌شود.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getGeminiSettings, resolveGeminiConfig, saveGeminiSettings, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from "@/services/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const [saved, runtime] = await Promise.all([getGeminiSettings(), resolveGeminiConfig()]);
  return ok({
    gemini: {
      saved: saved
        ? { hasKey: saved.hasKey, apiKeyMask: saved.apiKeyMask, enabled: saved.enabled, textModel: saved.textModel, imageModel: saved.imageModel }
        : null,
      runtime: {
        active: Boolean(runtime.apiKey) && runtime.enabled !== false,
        source: runtime.source, // db | env | null
        textModel: runtime.textModel,
        imageModel: runtime.imageModel,
      },
      defaults: { textModel: DEFAULT_TEXT_MODEL, imageModel: DEFAULT_IMAGE_MODEL },
      hint: "کلید رایگان: aistudio.google.com → Get API key → Create API key (با AIza شروع می‌شود)",
    },
  });
});

export const PUT = guard(async (req) => {
  const { user } = await requireAdminUser(req);
  const body = (await readBody(req, 20_000)) as Record<string, unknown>;

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : null;
  const enabled = body.enabled === undefined ? undefined : Boolean(body.enabled);
  const textModel = typeof body.textModel === "string" && body.textModel.trim() ? body.textModel.trim().slice(0, 80) : null;
  const imageModel = typeof body.imageModel === "string" && body.imageModel.trim() ? body.imageModel.trim().slice(0, 80) : null;

  if (apiKey === "") throw ApiError.badRequest("برای حذف کلید، مقدار خالی نفرستید — موتور را غیرفعال کنید");
  if (!apiKey && enabled === undefined && !textModel && !imageModel) {
    throw ApiError.badRequest("چیزی برای ذخیره ارسال نشده است");
  }

  const result = await saveGeminiSettings({ apiKey, enabled, textModel, imageModel, updatedBy: user.id });
  if (!result.saved) throw ApiError.badRequest(result.reason ?? "ذخیره تنظیمات ناموفق بود");

  const [savedAfter, runtime] = await Promise.all([getGeminiSettings(), resolveGeminiConfig()]);
  return ok({
    saved: true,
    gemini: {
      saved: savedAfter ? { hasKey: savedAfter.hasKey, apiKeyMask: savedAfter.apiKeyMask, enabled: savedAfter.enabled, textModel: savedAfter.textModel, imageModel: savedAfter.imageModel } : null,
      runtime: { active: Boolean(runtime.apiKey) && runtime.enabled !== false, source: runtime.source, textModel: runtime.textModel, imageModel: runtime.imageModel },
    },
  });
});
