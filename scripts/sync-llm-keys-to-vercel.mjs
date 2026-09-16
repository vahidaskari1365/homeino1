#!/usr/bin/env node
// ============================================================
// sync-llm-keys-to-vercel — یک‌بارِ امن: کلیدهای زنجیره‌ی LLM
// (سکرت مخزن LLM_KEYS_JSON) را به Environment Variables پروژه‌ی
// Vercel پوش می‌کند تا دستیار/استودیوی AI روی پروداکشن موتور واقعی
// داشته باشد.
//
// امنیت: مقدار هیچ کلیدی هرگز در لاگ چاپ نمی‌شود — فقط id/base/model
// و کد وضعیت HTTP. توکن Vercel از سکرت VERCEL_TOKEN می‌آید.
//
// ست می‌کند (target: production + preview):
//   • LLM_API_BASE_URL / LLM_API_KEY / LLM_MODEL  ← اولین entry
//     غیر-Gemini (OpenAI-compatible؛ برای چت/فهم/پیشنهاد ران‌تایم)
//   • GEMINI_API_KEY ← اولین entry ای که base گوگل دارد
//     (generativelanguage.googleapis.com) — ویرایش واقعی عکس
// ============================================================

const RAW = process.env.LLM_KEYS_JSON || "";
const TOKEN = process.env.VERCEL_TOKEN || "";
const PROJECT = process.env.VERCEL_PROJECT_ID || "";
const API = "https://api.vercel.com";

if (!RAW || !TOKEN || !PROJECT) {
  console.error("missing env: LLM_KEYS_JSON / VERCEL_TOKEN / VERCEL_PROJECT_ID");
  process.exit(1);
}

let entries = [];
try {
  const parsed = JSON.parse(RAW);
  const arr = Array.isArray(parsed) ? parsed : parsed?.keys;
  entries = Array.isArray(arr) ? arr.filter((c) => c?.base && c?.key) : [];
} catch {
  console.error("LLM_KEYS_JSON is not valid JSON");
  process.exit(1);
}
if (!entries.length) {
  console.error("LLM_KEYS_JSON has no usable entries");
  process.exit(1);
}

// لاگ امن — فقط فراداده، هرگز مقدار key
console.log(`entries: ${entries.length}`);
for (const c of entries) {
  console.log(`  - id=${c.id || "?"} base=${c.base} model=${c.model || "?"} keyLen=${String(c.key).length}`);
}

const isGemini = (c) => /generativelanguage\.googleapis\.com|gemini/i.test(`${c.base}`);
const textEntry = entries.find((c) => !isGemini(c)) ?? entries[0];
const geminiEntry = entries.find(isGemini) ?? null;

async function pushEnv(key, value) {
  const res = await fetch(
    `${API}/v10/projects/${PROJECT}/env?upsert=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview"] }),
    },
  );
  const body = await res.json().catch(() => ({}));
  const ok = res.ok;
  const created = body?.created?.key ?? body?.env?.key ?? body?.error?.code ?? "";
  console.log(`${ok ? "✅" : "❌"} ${key}: HTTP ${res.status} ${created}`);
  return ok;
}

let failures = 0;
const plan = [
  ["LLM_API_BASE_URL", textEntry.base],
  ["LLM_API_KEY", textEntry.key],
  ["LLM_MODEL", textEntry.model || "auto"],
];
if (geminiEntry) plan.push(["GEMINI_API_KEY", geminiEntry.key]);
else console.log("⚠ هیچ entry گوگلی در زنجیره نبود — GEMINI_API_KEY ست نشد");

for (const [key, value] of plan) {
  const ok = await pushEnv(key, value);
  if (!ok) failures++;
}
console.log(failures ? `done with ${failures} failures` : "all envs synced — Redeploy لازم است تا اعمال شود");
process.exit(failures ? 1 : 0);
