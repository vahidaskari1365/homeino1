import { NextResponse } from "next/server";
import { isZEngineConfigured } from "@/services/ai/engineConfig";
import { isOpenAiCompatConfigured } from "@/services/ai/llm/openaiCompatLlm";

// ============================================================
// GET /api/ai/status — تشخیص صادقانه وضعیت موتور هوش مصنوعی
// (بدون افشای هیچ کلیدی — فقط boolean و نام env)
//
// پاسخ به سؤال «چرا عکس درست نمیده»:
//   • تولید عکس: با هر provider واقعی یا fallback کلید-کمتر Pollinations انجام می‌شود
//   • ویرایش/استیجینگ (edit/inpaint): فقط با موتور واقعی — در نبودش پیش‌نمایش mock صادقانه
// ============================================================

export const dynamic = "force-dynamic";

export async function GET() {
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const zEngine = isZEngineConfigured();
  const openaiChat = isOpenAiCompatConfigured();
  const freellm = Boolean(process.env.FREELLMAPI_API_KEY && process.env.FREELLMAPI_BASE_URL);

  const active = gemini
    ? "gemini"
    : zEngine
      ? "zai"
      : openaiChat
        ? "openai-chat"
        : freellm
          ? "freellmapi"
          : "mock";

  return NextResponse.json({
    ok: true,
    active,
    // آیا ویرایش/استیجینگ واقعی ممکن است؟ (pollinations فقط تولید می‌کند، ویرایش نه)
    editCapable: gemini || zEngine || freellm,
    generationFallback: "pollinations", // کلید-کمتر، همیشه در دسترس برای تولید
    providers: {
      gemini: { configured: gemini, env: "GEMINI_API_KEY", quality: "بهترین کیفیت — رایگان از Google AI Studio" },
      zaiEngine: { configured: zEngine, env: "ZAI_API_BASE_URL + ZAI_API_KEY (یا فایل .z-ai-config)", quality: "موتور GLM — تولید + ویرایش" },
      openaiChat: { configured: openaiChat, env: "LLM_API_BASE_URL + LLM_API_KEY", quality: "فقط چت/متن — تصویر ندارد" },
      freellmapi: { configured: freellm, env: "FREELLMAPI_API_KEY + FREELLMAPI_BASE_URL", quality: "اختیاری، ایزوله" },
    },
  });
}
