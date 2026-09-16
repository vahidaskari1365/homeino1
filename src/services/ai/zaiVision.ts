// ============================================================
// Z-AI VISION FALLBACK (SERVER-ONLY) — رایگان و بدون کلیدِ گوگل.
//
// Task 39 — «یک عالمه هوش مصنوعی و LLMهای رایگان داریم؛ پس چرا به
// مشکل می‌خوریم؟» وقتی کلید Gemini نیست (سندباکس/خود-میزبان/پنل
// ادمین خالی)، تحلیل عکس و مکان‌یابی مبل نباید کور بمانند. این ماژول
// همان کار را با z-ai-web-dev-sdk (createVision) انجام می‌دهد.
//
// Fail-soft: هر خطایی → null — تماس‌گیرنده مسیر بعدی می‌رود.
// sdk فقط با import پویا لود می‌شود تا bundle کلاینت هرگز آن را
// نبیند و بیلد بدون نصبِ پکیج هم نشکند.
// ============================================================

type VisionContent = {
  role: "user";
  content: [
    { type: "text"; text: string },
    { type: "image_url"; image_url: { url: string } },
  ];
};

/** یک پرامپت + یک عکس → متن پاسخ مدل بینایی (یا null روی هر شکستی). */
export async function zaiVisionText(system: string, user: string, imageDataUrl: string): Promise<string | null> {
  try {
    const mod = await import("z-ai-web-dev-sdk");
    const ZAI = (mod as { default?: { create(): Promise<unknown> } }).default
      ?? (mod as { ZAI?: { create(): Promise<unknown> } }).ZAI;
    if (!ZAI?.create) return null;
    const zai = (await ZAI.create()) as {
      chat: { completions: { createVision: (args: Record<string, unknown>) => Promise<{
        choices?: { message?: { content?: string } }[];
      }> } };
    };
    const message: VisionContent = {
      role: "user",
      content: [
        { type: "text", text: `${system}\n\n${user}` },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    };
    const res = await zai.chat.completions.createVision({
      messages: [message],
      thinking: { type: "disabled" },
    });
    const text = res?.choices?.[0]?.message?.content ?? "";
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
