#!/usr/bin/env node
// ============================================================
// diagnose-gemini-key — یک‌بارِ امن: کلیدهای گوگلِ زنجیره را مستقیم
// به Gemini API صدا می‌زند و فقط «نتیجه» را لاگ می‌کند:
//   • کدام مدل‌های image برای این کلید در دسترس‌اند (نام مدل راز نیست)
//   • کد وضعیت واقعی generateContent برای مدل تصویر (429؟ 404؟ 200؟)
// مقدار کلید هرگز چاپ نمی‌شود.
// ============================================================

const RAW = process.env.LLM_KEYS_JSON || "";
let entries = [];
try {
  const parsed = JSON.parse(RAW);
  const arr = Array.isArray(parsed) ? parsed : parsed?.keys;
  entries = (Array.isArray(arr) ? arr : []).filter((c) => c?.key && /generativelanguage\.googleapis\.com/i.test(`${c.base}`));
} catch {
  console.error("LLM_KEYS_JSON is not valid JSON");
  process.exit(1);
}
if (!entries.length) {
  console.error("no google entries found");
  process.exit(0);
}

const key = entries[0].key;
const id = entries[0].id || "google-1";
const API = "https://generativelanguage.googleapis.com/v1beta";

// 1) مدل‌های قابل‌دسترس برای این کلید (فقط نام مدل‌های تصویری لاگ می‌شود)
const list = await fetch(`${API}/models?key=${key}&pageSize=200`).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }));
console.log(`[${id}] models.list: HTTP ${list.s}`);
if (list.s === 200) {
  const models = (list.j.models ?? []).map((m) => String(m.name || ""));
  const img = models.filter((n) => /image|imagen|banana/i.test(n));
  console.log(`[${id}] total models: ${models.length} | image-capable: ${img.length}`);
  for (const n of img) console.log(`   • ${n}`);
} else {
  const gcode = list.j?.error?.status || list.j?.error?.code || "";
  console.log(`[${id}] models.list failed: ${gcode}`);
}

// 2) وضعیت واقعی generateContent روی مدل‌های تصویر کاندید (بدون عکس — فقط متن)
const candidates = ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-2.0-flash-exp", "imagen-4.0-fast-generate-001"];
for (const model of candidates) {
  const r = await fetch(`${API}/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with a tiny 8x8 blue square image." }] }] }),
    signal: AbortSignal.timeout(45_000),
  }).catch((e) => null);
  if (!r) { console.log(`[${id}] ${model}: network-fail`); continue; }
  const j = await r.json().catch(() => ({}));
  const hasImg = (j?.candidates?.[0]?.content?.parts ?? []).some((p) => p.inline_data?.data);
  const gcode = r.ok ? (hasImg ? "IMAGE_OK" : "no-image-part") : (j?.error?.status || j?.error?.code || r.status);
  console.log(`[${id}] ${model}: HTTP ${r.status} → ${gcode}`);
  if (/quota/i.test(String(gcode)) && j?.error?.details) {
    // فقط کلاس کوتا — نه محتوا
    const q = j.error.details.find((x) => x["@type"]?.includes("QuotaFailure"));
    const v = q?.violations?.[0]?.quotaMetric || "";
    console.log(`   quota metric: ${v.slice(-80)}`);
  }
}
console.log("diagnose done (no key material logged)");
