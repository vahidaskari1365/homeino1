#!/usr/bin/env node
// ============================================================
// openverse-pool-topup — شارژ استخر عکس ایجنت الهام با Openverse
// ============================================================
// چرا؟ serper-pool-topup به SERPER_API_KEY نیاز دارد (در سیکرت‌ها نیست) و
// لینک‌های z-cdn منقضی می‌شوند (پوسیدگی استخر — ناظر سایت ❌). Openverse
// رایگان و بی‌کلید است و منابعش (فلیکر/ویکی‌مدیا/…) دامنه‌های پایدارند.
// هر کاندید قبل از افزودن HEAD-تأیید می‌شود — فقط لینک زنده وارد استخر می‌شود.
// اجرا: node scripts/openverse-pool-topup.mjs [--min-unused 130] [--max-searches 30]
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openverseImages } from "./lib/cover-pipeline.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const POOL_FILE = path.join(ROOT, "scripts", "inspiration-pool.json");
const GEN_FILE = path.join(ROOT, "src", "data", "inspirations.generated.json");

const argNum = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? Math.max(1, parseInt(process.argv[i + 1]) || dflt) : dflt;
};
const MIN_UNUSED = argNum("--min-unused", 130);
const MAX_SEARCHES = argNum("--max-searches", 30);
const MAX_ADDS_PER_COMBO = 6;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoInspirationBot/1.0; +https://homeino.ir)" };

// همان سبک/فضاهای expand-inspiration-pool.py — کوئری انگلیسی هم‌موضوع
const STYLES = [
  ["modern", "modern interior design living"],
  ["minimal", "minimalist interior clean lines"],
  ["scandinavian", "scandinavian interior bright cozy"],
  ["japandi", "japandi interior warm wood zen"],
  ["classic", "classic elegant interior ornate"],
  ["neoclassic", "neoclassical interior modern elegance"],
  ["industrial", "industrial interior brick metal loft"],
  ["boho", "bohemian interior colorful textiles plants"],
  ["rustic", "rustic interior wood beams stone fireplace"],
  ["mediterranean", "mediterranean interior white blue arches"],
  ["contemporary", "contemporary interior design sleek"],
  ["art-deco", "art deco interior glam gold velvet"],
];
const SPACES = [
  ["پذیرایی", "living room"],
  ["اتاق خواب", "bedroom"],
  ["فضای کار", "home office workspace"],
  ["ناهارخوری", "dining room"],
  ["بیرونی", "outdoor patio balcony"],
];
const TAILS = ["layout", "decor inspiration", "design ideas", "interior photo"];

async function headAlive(u) {
  try {
    const r = await fetch(u, { method: "HEAD", headers: UA, redirect: "follow", signal: AbortSignal.timeout(7000) });
    if (r.ok) return true;
    if (r.status === 405) {
      const g = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(9000) }).catch(() => null);
      try { await g?.body?.cancel(); } catch {}
      return !!g?.ok;
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const doc = JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
  const pool = doc.pool ?? {};
  const pins = new Set(
    (Array.isArray(json(GEN_FILE)) ? json(GEN_FILE) : [])
      .map((p) => p?.image)
      .filter(Boolean)
  );
  const seen = new Set(pins);
  for (const rooms of Object.values(pool)) {
    if (!rooms || typeof rooms !== "object") continue;
    for (const arr of Object.values(rooms)) {
      if (!Array.isArray(arr)) continue;
      for (const it of arr) if (it?.url) seen.add(it.url);
    }
  }
  const unusedCount = () => {
    let n = 0;
    for (const rooms of Object.values(pool)) {
      if (!rooms || typeof rooms !== "object") continue;
      for (const arr of Object.values(rooms)) {
        if (!Array.isArray(arr)) continue;
        for (const it of arr) if (it?.url && !pins.has(it.url)) n++;
      }
    }
    return n;
  };

  console.log(`openverse-pool-topup] شروع — مصرف‌نشده: ${unusedCount()} / هدف ≥ ${MIN_UNUSED}`);
  let searches = 0;
  let added = 0;
  let tailIdx = Math.floor(Math.random() * TAILS.length);

  comboLoop:
  for (let v = 0; v < TAILS.length; v++) {
    for (const [stSlug, stEn] of STYLES) {
      for (const [spSlug, spEn] of SPACES) {
        if (unusedCount() >= MIN_UNUSED) break comboLoop;
        if (searches >= MAX_SEARCHES) break comboLoop;
        const rooms = pool[stSlug] ?? {};
        if (!pool[stSlug]) pool[stSlug] = rooms;
        const arr = rooms[spSlug] ?? (rooms[spSlug] = []);
        if (!Array.isArray(arr)) continue;
        const unusedHere = arr.filter((it) => it?.url && !pins.has(it.url)).length;
        if (unusedHere >= 8) continue; // این ترکیب سیراب است
        const tail = TAILS[(tailIdx + v) % TAILS.length];
        const query = `${stEn} ${spEn} ${tail}`;
        searches++;
        let cands = [];
        try { cands = await openverseImages(query, 12); } catch { /* بی‌خیال این ترکیب */ }
        let addedHere = 0;
        for (const c of cands) {
          if (addedHere >= MAX_ADDS_PER_COMBO) break;
          if (unusedCount() >= MIN_UNUSED) break;
          if (!c?.url || seen.has(c.url)) continue;
          if (!(await headAlive(c.url))) continue; // فقط لینک تأییدشدهٔ زنده
          arr.push({ url: c.url, source: String(c.source || "openverse").slice(0, 60), w: c.w || 1200 });
          seen.add(c.url);
          added++;
          addedHere++;
        }
        if (addedHere) console.log(`  +${addedHere} → ${stSlug}×${spSlug} (مصرف‌نشده: ${unusedCount()})`);
        await new Promise((r) => setTimeout(r, 400)); // ادب در برابر API رایگان
      }
    }
  }

  if (added > 0) {
    fs.writeFileSync(POOL_FILE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    console.log(`openverse-pool-topup] ✓ ${added} عکس زندهٔ تأییدشده اضافه شد (${searches} جستجو) → ذخیره شد`);
  } else {
    console.log(`openverse-pool-topup] هیچ افزودنی (${searches} جستجو) — فایل دست‌نخورده ماند`);
  }
  const final = unusedCount();
  console.log(`openverse-pool-topup] مصرف‌نشدهٔ نهایی: ${final}${final < 40 ? " ⚠ زیر آستانهٔ ناظر (۴۰)" : " — سالم"}`);
  process.exit(0);
}

function json(f) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return []; }
}

main().catch((e) => {
  console.error("openverse-pool-topup] FATAL", e?.message ?? e);
  process.exit(0); // شارژ اختیاری است — نباید ایجنت الهام را قرمز کند
});
