// Task 39 — CYCLIC E2E TEST of the homeino AI studio against the local dev
// server, exactly as the owner demanded: one real room photo, EVERY category
// swapped one by one, then every style — and the output images are saved for
// visual inspection.
//
//   node scripts/ai-cycle-test.mjs analyze
//   node scripts/ai-cycle-test.mjs detect
//   node scripts/ai-cycle-test.mjs cat furniture dining curtain carpet lighting
//   node scripts/ai-cycle-test.mjs style modern classic minimalist
//   node scripts/ai-cycle-test.mjs list
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT_DIR = "/home/z/my-project/download/ai-test";
const ROOM = "/home/z/my-project/homeino-live/public/images/samples/room-1.jpg";
mkdirSync(OUT_DIR, { recursive: true });

const roomB64 = `data:image/jpeg;base64,${readFileSync(ROOM).toString("base64")}`;

/** Catalog product per category slug (from src/components/ai/design/constants.ts CAT_PRODUCTS + products data). */
const PRODUCTS = JSON.parse(readFileSync("/home/z/my-project/scripts/ai-test-products.json", "utf8"));

const CATEGORY_TARGETS = {
  furniture: "sofa", dining: "table", curtain: "curtain", carpet: "rug",
  lighting: "lighting", "tv-console": "tv", "bookcase-shoe": "shelf",
  bedding: "bed", plants: "plant", art: "art", accessories: "art",
  office: "table", "second-hand": "sofa",
};

async function post(action, payload) {
  const res = await fetch(`${BASE}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
    signal: AbortSignal.timeout(240_000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

function saveImage(name, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const b64 = dataUrl.split(",")[1] ?? "";
  if (b64.length < 2000) return null; // too small to be a real render
  const path = `${OUT_DIR}/${name}.png`;
  writeFileSync(path, Buffer.from(b64, "base64"));
  return path;
}

async function caseAnalyze() {
  console.log("== ANALYZE (بگه چی کم داره) ==");
  const { status, json } = await post("analyze", {
    mode: "room-redesign", prompt: "تحلیل", referenceImage: roomB64, room: "نشیمن", style: "modern",
  });
  console.log(`HTTP ${status} source=${json._analysisSource}`);
  console.log(`roomType=${json.roomType} | style=${json.style} | conf=${json.confidence}`);
  console.log(`furniture=${(json.furniture ?? []).slice(0, 6).join("، ")}`);
  console.log(`چی کم داره (emptySpaces)=${(json.emptySpaces ?? []).join(" | ")}`);
  console.log(`functionalIssues=${(json.functionalIssues ?? []).slice(0, 3).join(" | ")}`);
}

async function caseDetect() {
  console.log("== DETECT (vision locate) ==");
  const { status, json } = await post("detect-objects", {
    referenceImage: roomB64,
    categories: ["furniture", "curtain", "carpet", "lighting", "dining"],
  });
  console.log(`HTTP ${status} objects=${json.objects?.length ?? 0}`);
  for (const o of json.objects ?? []) {
    const { x, y, w, h } = o.region ?? {};
    console.log(`  ${o.type}: x=${x?.toFixed(2)} y=${y?.toFixed(2)} w=${w?.toFixed(2)} h=${h?.toFixed(2)}`);
  }
}

async function caseCategory(slug) {
  const prod = PRODUCTS[slug];
  if (!prod) return console.log(`[${slug}] NO PRODUCT CONFIGURED`);
  const target = CATEGORY_TARGETS[slug] ?? "sofa";
  const label = prod.label;
  console.log(`\n== CAT ${slug} (${label} → ${target}) ==`);
  const t0 = Date.now();
  const { status, json } = await post("pipeline", {
    prompt: `مبل و دکور اتاق را ببین و فقط ${label} را با ${prod.name} عوض کن. بقیه‌ی عکس دست نخورد.`,
    style: "modern",
    room: "نشیمن",
    scope: "targeted",
    targets: [target],
    referenceImage: roomB64,
    selection: { category: slug, subTypes: [label] },
    products: [{ id: prod.id, name: prod.name, category: slug, image: prod.image }],
    productId: prod.id,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (status !== 200) return console.log(`  HTTP ${status} ERROR: ${json.error ?? json.raw}`);
  const after = json.result?.afterImage;
  const changed = after && after !== roomB64;
  const saved = changed ? saveImage(`cat-${slug}`, after) : null;
  console.log(`  engine=${json.imageEngine} scope=${json.scope} pixelLocked=${json.pixelLocked} located=${json.locatedRegions?.length ?? 0} (${secs}s)`);
  console.log(`  changed=${Boolean(changed)} saved=${saved ?? "-"}`);
  if (json.validation?.status !== "completed") console.log(`  validation=${json.validation?.status} ${json.validation?.reasons?.join("،")}`);
}

async function caseStyle(style) {
  console.log(`\n== STYLE ${style} (full redesign) ==`);
  const t0 = Date.now();
  const { status, json } = await post("pipeline", {
    prompt: `این اتاق را کاملاً به سبک ${style} بازطراحی کن`,
    style,
    room: "نشیمن",
    scope: "full",
    referenceImage: roomB64,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (status !== 200) return console.log(`  HTTP ${status} ERROR: ${json.error ?? json.raw}`);
  const after = json.result?.afterImage;
  const changed = after && after !== roomB64;
  const saved = changed ? saveImage(`style-${style}`, after) : null;
  console.log(`  engine=${json.imageEngine} scope=${json.scope} (${secs}s) changed=${Boolean(changed)} saved=${saved ?? "-"}`);
}

const CASES = {
  analyze: caseAnalyze,
  detect: caseDetect,
};

const [, , mode, ...args] = process.argv;
if (mode === "list") { console.log(Object.keys(CASES).join(", "), "| cats:", Object.keys(PRODUCTS).join(", ")); process.exit(0); }
if (mode === "cat") { for (const c of args) await caseCategory(c); process.exit(0); }
if (mode === "style") { for (const s of args) await caseStyle(s); process.exit(0); }
if (CASES[mode]) { await CASES[mode](); process.exit(0); }
console.log("usage: ai-cycle-test.mjs analyze|detect|cat <slugs…>|style <ids…>|list");
