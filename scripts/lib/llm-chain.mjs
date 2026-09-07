// ============================================================
// llm-chain — زنجیره چندکلیدی LLM مشترکِ ایجنت‌های محتوایی هومینو
// (magazine-daily + inspiration-daily)
//
// اولویت تلاش‌ها:
//   1) LLM_KEYS_JSON — سکرت مخزن؛ آرایه‌ای از {id, base, key, model, maxTokens?}
//      چند ارائه‌دهنده/چند کلید = توزیع بار + جانشینی خودی؛ نقطه شروع هر ران
//      بر اساس ساعت UTC می‌چرخد تا فشار روی همه کلیدها پخش شود
//   2) LLM_API_KEY + LLM_BASE_URL (+ LLM_MODEL) — کلید تکی (سازگاری قدیمی)
//   3) OMNIROUTE_BASE_URL — گیت‌وی خودمیزبان (مدل auto)
//   4) z-ai-web-dev-sdk — فقط در سندباکس
//
// هر تلاش ۲ بار امتحان می‌شود (فاصله ۸ ثانیه برای 429/5xx) سپس کلید بعدی.
// خروجی null یعنی هیچ مسیری در دسترس نبود — فراخوان باید صادقانه لاگ کند.
// ============================================================

const DEFAULT_TIMEOUT = 100_000;

export async function chatCompletion(base, model, apiKey, messages, maxTokens, timeoutMs = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const retriable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      return { error: `HTTP ${res.status}: ${body.slice(0, 140)}`, retriable };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    return { content, finish: json?.choices?.[0]?.finish_reason };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : e?.message ?? "fetch failed", retriable: true };
  } finally {
    clearTimeout(t);
  }
}

function parseAttempts() {
  const { LLM_KEYS_JSON, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, OMNIROUTE_BASE_URL, OMNIROUTE_API_KEY } = process.env;
  const attempts = [];

  // 1) زنجیره چندکلیدی از سکرت LLM_KEYS_JSON
  if (LLM_KEYS_JSON) {
    try {
      const parsed = JSON.parse(LLM_KEYS_JSON);
      const arr = Array.isArray(parsed) ? parsed : parsed?.keys;
      for (const c of Array.isArray(arr) ? arr : []) {
        if (c?.base && c?.key && c?.model) {
          attempts.push({
            id: c.id || `key-${attempts.length + 1}`,
            base: c.base,
            model: c.model,
            key: c.key,
            maxTokens: c.maxTokens ?? 2400,
          });
        }
      }
    } catch {
      console.log("llm-chain: LLM_KEYS_JSON is not valid JSON — skipping it");
    }
  }
  // 2) کلید تکی سازگاری-قدیمی
  if (LLM_API_KEY && LLM_BASE_URL) {
    attempts.push({ id: `env:${LLM_MODEL || "default"}`, base: LLM_BASE_URL, model: LLM_MODEL || "gpt-4o-mini", key: LLM_API_KEY, maxTokens: 2400 });
  }
  // 3) گیت‌وی خودمیزبان OmniRoute
  if (OMNIROUTE_BASE_URL) {
    attempts.push({ id: "omniroute:auto", base: OMNIROUTE_BASE_URL, model: "auto", key: OMNIROUTE_API_KEY || "", maxTokens: 3000 });
  }

  // چرخش ساعتی نقطه شروع = توزیع بار بین کلیدها در طول روز
  if (attempts.length > 1) {
    const start = Math.floor(Date.now() / 3_600_000) % attempts.length;
    return [...attempts.slice(start), ...attempts.slice(0, start)];
  }
  return attempts;
}

export async function callLlm(messages) {
  const attempts = parseAttempts();

  for (const a of attempts) {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const r = await chatCompletion(a.base, a.model, a.key, messages, a.maxTokens);
      if (r.content && r.content.trim()) {
        if (tryNo > 0 || a !== attempts[0]) console.log(`  llm via ${a.id}${tryNo ? " (retry)" : ""}`);
        callLlm.lastVia = a.id;
        return r.content;
      }
      if (r.error && !r.retriable) {
        console.log(`  llm ${a.id}: ${r.error}`);
        break; // کلید بعدی
      }
      if (tryNo === 0) await new Promise((s) => setTimeout(s, 8_000)); // فاصله برای 429/5xx
      else console.log(`  llm ${a.id}: ${r.error ?? "empty"}`);
    }
  }

  // 4) سندباکس: z-ai-web-dev-sdk (بیرون از Actions در دسترس نیست — بی‌ضرر می‌گذرد)
  try {
    const mod = await import("z-ai-web-dev-sdk");
    const ZAI = mod.default ?? mod;
    const zai = await ZAI.create();
    const res = await zai.chat.completions.create({ messages, temperature: 0.7 });
    const out = res?.choices?.[0]?.message?.content ?? "";
    if (out) {
      callLlm.lastVia = "zai-sdk";
      return out;
    }
  } catch { /* LLM در دسترس نیست */ }

  callLlm.lastVia = null;
  return null;
}
