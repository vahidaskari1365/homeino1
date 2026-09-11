#!/usr/bin/env node
/**
 * fetch-style-images — جایگزینی عکس‌های ضعیف سبک‌ها با عکس واقعی وب
 * دانلود در public/images/styles/<slug>.jpg + خروجی JSON از نتیجه‌ها
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO, "public", "images", "styles");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoBot/1.0; +https://homeino.ir)", Accept: "image/*" };

const JOBS = [
  ["minimal", "minimalist living room interior beige calm design"],
  ["neoclassical", "neoclassical interior elegant molding modern luxury"],
  ["industrial", "industrial loft interior brick concrete leather"],
  ["japandi", "japandi interior warm wood zen bedroom"],
  ["rustic", "rustic living room stone fireplace wood beams"],
];

function search(q) {
  const raw = execFileSync("z-ai", ["image-search", "-q", q, "--count", "6", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
  const j = JSON.parse(raw.slice(raw.indexOf("{")));
  return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 0, h: parseInt(r.original_height) || 0 }));
}

const report = {};
for (const [slug, q] of JOBS) {
  process.stdout.write(`→ ${slug} ... `);
  const outPath = path.join(OUT_DIR, `${slug}.jpg`);
  if (fs.existsSync(outPath)) { console.log("قبلاً هست — رد شد"); continue; }
  let done = false;
  try {
    const hits = search(q).filter((p) => p.w >= 900 && p.h >= 600).sort((a, b) => Math.abs(a.w / a.h - 1.5) - Math.abs(b.w / b.h - 1.5));
    for (const hit of hits.slice(0, 4)) {
      try {
        const res = await fetch(hit.url, { headers: UA, signal: AbortSignal.timeout(20000) });
        if (!res.ok) continue;
        const type = (res.headers.get("content-type") || "").toLowerCase();
        if (!type.startsWith("image/") || /svg|icon/.test(type)) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 40000) continue; // کیفیت پایین را رد کن
        fs.writeFileSync(outPath, buf);
        report[slug] = { url: hit.url, source: hit.source, kb: Math.round(buf.length / 1024) };
        console.log(`✓ ${hit.source} (${Math.round(buf.length / 1024)}KB)`);
        done = true;
        break;
      } catch { continue; }
    }
  } catch (e) { console.log(`search err: ${e.message}`); }
  if (!done) console.log("✗");
}

fs.writeFileSync(path.join(__dirname, "style-images-report.json"), JSON.stringify(report, null, 2));
console.log("done:", Object.keys(report).join(", "));
