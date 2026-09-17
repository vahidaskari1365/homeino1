// ============================================================
// ROOM ANALYSIS SERVICE (SERVER-ONLY) — «بگه چی کم داره».
//
// Task 39 — زنجیره‌ی تحلیل عکس آپلودی. قاعده‌ی طلایی: **عکسِ کاربر باید
// واقعاً دیده شود.** تحلیلِ متنیِ صرف (LLM بدون عکس) توهمِ قانع‌کننده
// می‌سازد (تست زنده ۲۰۲۶-۰۹-۱۶: zaiProvider تحلیل متنی، از جمله
// «کاناپه» را حدس زد و درست از آب درآمد — گمراه‌کننده).
//
//   با عکس:
//     1. Gemini vision (کلید پنل ادمین/env) — عکس را inline می‌بیند
//     2. z-ai vision رایگان (createVision) — بدون هیچ کلیدی
//     3. Provider فعلی (متنی/نمونه) — صادقانه با منبعِ برچسب‌خورده
//   بدون عکس:
//     Provider فعلی.
// هرگز نمی‌پرد؛ «منبع» همیشه در _analysisSource می‌آید.
// ============================================================
import type { GenerateDesignInput, RoomAnalysis } from "./types";
import { shrinkForVision } from "./imageShrink";
import { zaiVisionText } from "./zaiVision";
import { ROOM_ANALYSIS_VISION_SYSTEM, roomAnalysisVisionUser, parseRoomAnalysisFa } from "./geminiProvider";

export async function analyzeRoomWithFallback(
  input: GenerateDesignInput,
): Promise<{ analysis: RoomAnalysis; source: string }> {
  const { resolveProvider } = await import("./provider");
  const { provider, name } = await resolveProvider();

  if (input.referenceImage) {
    // Task 47 — عکس‌های بزرگ در vision شکست بی‌صدا می‌خوردند؛ اول کوچک می‌شود.
    input.referenceImage = await shrinkForVision(input.referenceImage);
    // 1) Gemini — vision بومی (عکس inline به مدل می‌رود).
    if (name === "gemini") {
      try {
        return { analysis: await provider.analyzeRoom(input), source: name };
      } catch (err) {
        // Task 47 — دیگر بی‌صدا نیست: دلیل واقعی در لاگ ورسل می‌آید.
        console.error("[analyze] gemini vision failed:", err instanceof Error ? err.message : err);
      }
    }
    // 2) fallback رایگان — z-ai vision روی همین عکس.
    const raw = await zaiVisionText(ROOM_ANALYSIS_VISION_SYSTEM, roomAnalysisVisionUser(input), input.referenceImage);
    if (raw) {
      try {
        return { analysis: parseRoomAnalysisFa(raw, input), source: "zai-vision-free" };
      } catch { /* fall through */ }
    }
  }

  // 3) مسیر متنی/نمونه — فقط وقتی هیچ موتور بینایی در دسترس نبود.
  try {
    const analysis = await provider.analyzeRoom(input);
    return { analysis, source: name === "mock" ? "sample" : `${name}-text-only` };
  } catch {
    return { analysis: await (await import("./mockAiService")).mockAiProvider.analyzeRoom(input), source: "sample" };
  }
}
