#!/usr/bin/env node
/**
 * make-logo-assets — ساخت خانواده لوگوی هومینو از مونوگرام بازسازی‌شده
 * ====================================================================
 * مونوگرام «خانه + قوس + H» با پالت سایت (زمرد #1E5D44، طلایی #BE9A4F،
 * کرم #F5EEE0، جوهری #10201A) به‌صورت وکتور بازسازی و خروجی‌ها ساخته می‌شود:
 *   - public/brand/logo-mark.png        مونوگرام شفاف ۱۰۲۴ (نسخه روشن)
 *   - public/brand/logo-mark-dark.png   مونوگرام شفاف ۱۰۲۴ (نسخه زمینه تیره)
 *   - public/brand/logo-lockup-dark.png لوگوی کامل روی زمینه جوهری (مثل اصل کاربر)
 *   - public/brand/logo-lockup-light.png لوگوی کامل روی زمینه کرم
 *   - src/app/icon.png (۵۱۲) + src/app/apple-icon.png (۱۸۰) + src/app/favicon.ico
 * اجرا: node scripts/make-logo-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

// ---- پالت سایت (منبع حقیقت: src/app/globals.css) ----
const C = {
  ink: "#10201A",
  ivory: "#F0E8D8",
  cream: "#F5EEE0",
  emerald: "#1E5D44",
  emeraldDeep: "#0F3A27",
  gold: "#BE9A4F",
  goldSoft: "#D9BD7E",
};

// ---- مونوگرام: خانه + قوس + H ----
// viewBox 0 0 140 144 — سقف شیب‌دار طلایی، دیوار چپ خطی جوهری،
// مصراع H جوهری، قوس زمردی (عنصر قهرمان). propها فقط رنگ‌ها را عوض می‌کنند.
function monogram({ roof, wall, bar, arch, strokeScale = 1 }) {
  const s = (n) => +(n * strokeScale).toFixed(2);
  return `
  <g fill="none">
    <!-- سقف -->
    <polyline points="16,44 76,15 136,44" stroke="${roof}" stroke-width="${s(4.5)}" stroke-linejoin="miter" stroke-linecap="butt"/>
    <!-- دیوار چپ (خطی) -->
    <rect x="31.5" y="49" width="14.5" height="90" stroke="${wall}" stroke-width="${s(3.4)}"/>
    <!-- مصراع H -->
    <rect x="46" y="86" width="32" height="10.5" fill="${bar}"/>
    <!-- قوس (دیوار راست) -->
    <path d="M 83 139 L 83 50 A 17 17 0 0 1 117 50 L 117 139" stroke="${arch}" stroke-width="${s(11)}"/>
  </g>`;
}

// نسخه فاوآیکون: ساده و پررنگ روی کاشی جوهری — در ۱۶-۳۲px خوانا
function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="${C.ink}"/>
  <g fill="none">
    <polyline points="26,52 64,26 102,52" stroke="${C.gold}" stroke-width="7" stroke-linejoin="miter"/>
    <path d="M 50 100 L 50 58 A 14 14 0 0 1 78 58 L 78 100" stroke="${C.goldSoft}" stroke-width="10"/>
  </g></svg>`;
}

const svgMarkLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 144">${monogram({
  roof: C.gold, wall: C.ink, bar: C.ink, arch: C.emerald,
})}</svg>`;

const svgMarkDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 144">${monogram({
  roof: C.goldSoft, wall: C.cream, bar: C.cream, arch: C.gold,
})}</svg>`;

// لوگوی کامل (لاک‌آپ): مونوگرام + HOMEINO با سریف با حروف‌فاصله‌دار — مثل اصل کاربر
function lockupSvg({ bg, roof, wall, bar, arch, text }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="${bg}"/>
  <g transform="translate(600,120) scale(2.2) translate(-75,0)">${monogram({ roof, wall, bar, arch })}</g>
  <text x="600" y="612" text-anchor="middle" font-family="Tinos, 'Times New Roman', Georgia, serif"
    font-size="116" letter-spacing="24" fill="${text}">HOMEINO</text>
</svg>`;
}

const svgLockupDark = lockupSvg({
  bg: C.ink, roof: C.goldSoft, wall: C.cream, bar: C.cream, arch: C.gold, text: C.cream,
});
const svgLockupLight = lockupSvg({
  bg: C.cream, roof: C.gold, wall: C.ink, bar: C.ink, arch: C.emerald, text: C.ink,
});

// صفحه پیش‌نمایش برای بازبینی چشمی — همه واریانت‌ها یک‌جا
const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <rect width="800" height="450" fill="${C.cream}"/>
  <rect x="800" width="800" height="450" fill="${C.ink}"/>
  <rect y="450" width="800" height="450" fill="${C.ivory}"/>
  <rect x="800" y="450" width="800" height="450" fill="${C.ink}"/>
  <g transform="translate(330,80) scale(1.15)">${monogram({ roof: C.gold, wall: C.ink, bar: C.ink, arch: C.emerald })}</g>
  <g transform="translate(1130,80) scale(1.15)">${monogram({ roof: C.goldSoft, wall: C.cream, bar: C.cream, arch: C.gold })}</g>
  <g transform="translate(120,520) scale(0.85)">${monogram({ roof: C.gold, wall: C.ink, bar: C.ink, arch: C.emerald })}</g>
  <text x="330" y="860" text-anchor="middle" font-family="Tinos, serif" font-size="44" letter-spacing="10" fill="${C.ink}">HOMEINO</text>
  <g transform="translate(920,520) scale(0.85)">${monogram({ roof: C.goldSoft, wall: C.cream, bar: C.cream, arch: C.gold })}</g>
  <text x="1130" y="860" text-anchor="middle" font-family="Tinos, serif" font-size="44" letter-spacing="10" fill="${C.cream}">HOMEINO</text>
  <g transform="translate(1400,540)">
    <rect width="128" height="128" rx="28" fill="${C.ink}" stroke="${C.gold}" stroke-width="1.5" stroke-opacity="0.4"/>
    <g fill="none" transform="translate(14,-88) scale(0.78) translate(64,64) scale(1) translate(-64,-64)">
      <polyline points="16,44 76,15 136,44" stroke="${C.gold}" stroke-width="7"/>
      <path d="M 83 139 L 83 50 A 17 17 0 0 1 117 50 L 117 139" stroke="${C.goldSoft}" stroke-width="13"/>
    </g>
  </g>
</svg>`;

// ICO با کانتینر PNG (استاندارد از ویستا به بعد) — ۱۶/۳۲/۴۸
async function writeIco(pngBufs, sizes, dest) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const entries = [];
  let offset = 6 + 16 * sizes.length;
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16);
    e[0] = sizes[i] >= 256 ? 0 : sizes[i];
    e[1] = sizes[i] >= 256 ? 0 : sizes[i];
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngBufs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngBufs[i].length;
    entries.push(e);
  }
  fs.writeFileSync(dest, Buffer.concat([header, ...entries, ...pngBufs]));
}

async function main() {
  const brandDir = path.join(REPO, "public", "brand");
  fs.mkdirSync(brandDir, { recursive: true });

  const jobs = [
    [svgMarkLight, path.join(brandDir, "logo-mark.png"), 1024],
    [svgMarkDark, path.join(brandDir, "logo-mark-dark.png"), 1024],
    [svgLockupDark, path.join(brandDir, "logo-lockup-dark.png"), 1200],
    [svgLockupLight, path.join(brandDir, "logo-lockup-light.png"), 1200],
    [previewSvg, "/tmp/logo-preview.png", 1600],
    [faviconSvg(), "/tmp/favicon-256.png", 256],
  ];
  for (const [svg, dest, w] of jobs) {
    await sharp(Buffer.from(svg), { density: 300 }).resize({ width: w }).png().toFile(dest);
    console.log("✓", path.basename(dest));
  }

  // فاوآیکون‌های اپ‌روتر
  const fav256 = fs.readFileSync("/tmp/favicon-256.png");
  await sharp(fav256).resize(512, 512).png().toFile(path.join(REPO, "src", "app", "icon.png"));
  await sharp(fav256).resize(180, 180).png().toFile(path.join(REPO, "src", "app", "apple-icon.png"));
  const ico16 = await sharp(fav256).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(fav256).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(fav256).resize(48, 48).png().toBuffer();
  await writeIco([ico16, ico32, ico48], [16, 32, 48], path.join(REPO, "src", "app", "favicon.ico"));
  console.log("✓ icon.png / apple-icon.png / favicon.ico");

  // کاشی فاوآیکون بزرگ هم برای برند
  fs.copyFileSync("/tmp/favicon-256.png", path.join(brandDir, "logo-tile.png"));
  console.log("✓ logo-tile.png");
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
