// ============================================================
// HOMEINO — VISUAL SCAN (SERVER-ONLY)
//
// مالک ۲۰۲۶-۰۹-۲۰: «اسکن بصری باید مدل‌های داخل سایت را بگردد و
// مدلش را که پیدا کرد لیست کند» — قبلاً یک شافل تصادفی از محصولات
// استاتیک بود؛ حالا عکسِ کاربر واقعاً دیده می‌شود و با کاتالوگ زندهٔ
// سایت (DB → فیکسچر دمو) تطبیق داده می‌شود.
//
// Chain (همیشه صادقانه، هرگز تصادفی):
//   1. Gemini vision (وقتی کلید هست) → z-ai vision (کلید-کمتر)
//   2. امتیازدهی محلی روی catalogPool() → کاندیدهای واقعی
//   3. رتبه‌بندی نهایی با بینایی + راستی‌آزمایی id روی کاتالوگ
//   فالبک صادقانه: بدون بینایی → محبوب‌های کاتالوگ با notice روشن.
// ============================================================
import type { ScanIdentification, ScanMatch, VisualScanResult } from "./scanTypes";
import { shrinkForVision } from "./imageShrink";
import { zaiVisionText } from "./zaiVision";
import { catalogPool } from "../agents/catalog";
import { extractJsonPayload } from "./validation";

const SCAN_IDENTIFY_SYSTEM = `تو کارشناس شناسایی کالای دکوراسیون هستی. به عکسِ آپلودشدهٔ کاربر نگاه کن و کالای اصلی را شناسایی کن.
فقط و فقط یک JSON معتبر برگردان، بدون هیچ متن اضافه:
{"label":"نام کوتاه فارسی کالا مثل: کاناپه سه‌نفره مخمل","categorySlug":"یکی از furniture|rugs|lighting|decor|textiles|bedroom|workspace|outdoor|kitchen","subCategory":"زیردسته مثل sofa|armchair|coffee-table|rug|carpet|lamp|curtain|bed|desk","styleSlugs":["از modern|classic|minimalist|luxury|scandinavian|industrial|bohemian|japanese|art-deco|contemporary|japandi|minimal"],"colors":["نام رنگ فارسی"],"materials":["نام جنس فارسی"],"room":"living|bedroom|kitchen|dining|office|outdoor","confidence":عدد بین 0 و 1}
اگر عکس اصلاً کالای دکوراسیون/مبلمان نبود: {"label":null}`;

const SCAN_RANK_SYSTEM = `لیست محصولات واقعی فروشگاه دکوراسیون هومینو + عکس کالایی که کاربر دوست دارد، داده می‌شود.
از لیست، مناسب‌ترین محصولات را به عکس رتبه بکن (شباهت شکل/سبک/رنگ/جنس/کاربرد).
فقط و فقط JSON معتبر برگردان، بدون متن اضافه:
{"matches":[{"id":"همان id لیست","score":عدد 0 تا 100,"reason":"یک جملهٔ کوتاه فارسی که بگوید چرا این محصول به عکس نزدیک است"}]}
حداکثر ۶ مورد و id فقط از همین لیست. اگر هیچ تطبیقی نیست، نزدیک‌ترین‌ها را با reason صادقانه بده.`;

const MAX_CANDIDATES = 24;
const MAX_MATCHES = 6;

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return extractJsonPayload(raw) as T;
  } catch {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

/** Compact candidate card for the ranking prompt (keeps the context small). */
function candidateCard(p: Awaited<ReturnType<typeof catalogPool>>[number]): string {
  const desc = (p.description ?? "").replace(/\s+/g, " ").slice(0, 90);
  return `{"id":"${p.id}","name":"${p.name}","brand":"${p.brand}","category":"${p.categorySlug ?? ""}","sub":"${p.subCategorySlug ?? ""}","styles":["${p.styleSlugs.join('","')}"],"colors":["${p.colors.join('","')}"],"materials":["${p.materials.join('","')}"],"price":${p.price},"desc":"${desc}"}`;
}

/** Ask the vision engine. z-ai vision is keyless — same free path the
 *  room analysis falls back to; works in sandbox AND production. */
async function visionCall(system: string, user: string, imageDataUrl: string): Promise<string | null> {
  return zaiVisionText(system, user, imageDataUrl);
}

/** Category synonyms → the REAL catalog vocabulary (furniture, rugs, lighting,
 *  decor, textiles, bedroom, workspace, outdoor, kitchen). */
const CATEGORY_SYNONYMS: Record<string, string> = {
  carpet: "rugs", rug: "rugs", rugs: "rugs",
  curtain: "textiles", textile: "textiles", textiles: "textiles",
  bedding: "bedroom", bed: "bedroom", bedroom: "bedroom",
  plants: "outdoor", plant: "outdoor", outdoor: "outdoor",
  art: "decor", accessories: "decor", decor: "decor", decoration: "decor",
  office: "workspace", desk: "workspace", workspace: "workspace",
  dining: "kitchen", kitchen: "kitchen",
  sofa: "furniture", furniture: "furniture", "tv-console": "furniture", "bookcase-shoe": "furniture",
};

/** Local attribute score — deterministic, never random. */
function localScore(
  p: Awaited<ReturnType<typeof catalogPool>>[number],
  ident: ScanIdentification | null,
): number {
  if (!ident?.label) return 0;
  let score = 0;
  const sub = (ident.subCategory ?? "").toLowerCase();
  const cat = CATEGORY_SYNONYMS[(ident.categorySlug ?? "").toLowerCase()] ?? (ident.categorySlug ?? "").toLowerCase();
  const pCat = CATEGORY_SYNONYMS[(p.categorySlug ?? "").toLowerCase()] ?? (p.categorySlug ?? "").toLowerCase();
  if (cat && pCat === cat) score += 40;
  if (sub && ((p.subCategorySlug ?? "").toLowerCase().includes(sub) || p.name.toLowerCase().includes(sub))) score += 25;
  const styles = new Set(p.styleSlugs.map((s) => s.toLowerCase()));
  score += 8 * ident.styleSlugs.filter((s) => styles.has(s.toLowerCase())).length;
  const colorSet = new Set(p.colors.map((c) => c.replace(/\s+/g, "")));
  score += 6 * ident.colors.filter((c) => colorSet.has(c.replace(/\s+/g, ""))).length;
  const matSet = new Set(p.materials.map((m) => m.replace(/\s+/g, "")));
  score += 4 * ident.materials.filter((m) => matSet.has(m.replace(/\s+/g, ""))).length;
  if (ident.room && p.rooms.includes(ident.room)) score += 6;
  // Popularity as a soft tie-breaker (real sales signals, not random).
  score += Math.min(6, p.salesCount / 100);
  return score;
}

function localReason(
  p: Awaited<ReturnType<typeof catalogPool>>[number],
  ident: ScanIdentification | null,
): string {
  if (!ident?.label) return "از پرفروش‌ترین محصولات هومینو";
  const bits: string[] = [];
  const pCat = CATEGORY_SYNONYMS[(p.categorySlug ?? "").toLowerCase()] ?? (p.categorySlug ?? "").toLowerCase();
  const iCat = CATEGORY_SYNONYMS[(ident.categorySlug ?? "").toLowerCase()] ?? (ident.categorySlug ?? "").toLowerCase();
  if (iCat && pCat === iCat) bits.push("هم‌دستهٔ کالای عکس");
  if (p.styleSlugs.some((s) => ident.styleSlugs.includes(s))) bits.push("سبک نزدیک");
  if (p.colors.some((c) => ident.colors.includes(c))) bits.push("رنگ هم‌خانواده");
  if (!bits.length) bits.push("نزدیک‌ترین گزینهٔ کاتالوگ به عکس تو");
  return bits.join(" · ");
}

function toMatch(
  p: Awaited<ReturnType<typeof catalogPool>>[number],
  score: number,
  reason: string,
): ScanMatch {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    price: p.price,
    currency: p.currency || "تومان",
    image: p.images[0] ?? "",
    categorySlug: p.categorySlug ?? "furniture",
    score: clampScore(score),
    reason: reason.slice(0, 120),
    inStock: p.inStock,
  };
}

export async function scanCatalogForImage(input: { referenceImage: string }): Promise<VisualScanResult> {
  const image = await shrinkForVision(input.referenceImage);
  const pool = await catalogPool();

  // ---- Stage 1: what IS the item in the photo? ----
  const rawIdent = await visionCall(SCAN_IDENTIFY_SYSTEM, "این عکس را شناسایی کن:", image);
  const ident = parseJson<ScanIdentification>(rawIdent);
  const validIdent =
    ident && typeof ident.label === "string" && ident.label.trim() ? ident : null;

  if (!validIdent) {
    // Honest degradation — never pretend random products are "matches".
    const popular = [...pool]
      .sort((a, b) => b.salesCount - a.salesCount || b.rating - a.rating)
      .slice(0, MAX_MATCHES)
      .map((p) => toMatch(p, 60, "از پرفروش‌ترین محصولات هومینو"));
    return {
      visionAvailable: false,
      identified: null,
      matches: popular,
      notice: rawIdent
        ? "عکس یک کالای دکوراسیون شناسایی نشد — این محبوب‌ترین‌های هومینو هستند؛ می‌توانی عکس واضح‌تری از کالا آپلود کنی."
        : "موتور بینایی همین لحظه در دسترس نیست — این محبوب‌ترین‌های هومینو هستند؛ بعداً دوباره امتحان کن.",
    };
  }

  // ---- Stage 2: deterministic local prefilter over the REAL catalog ----
  const scored = pool
    .map((p) => ({ p, s: localScore(p, validIdent) }))
    .sort((a, b) => b.s - a.s || b.p.salesCount - a.p.salesCount);
  const candidates = scored.slice(0, MAX_CANDIDATES).map((c) => c.p);

  // ---- Stage 3: vision ranking of the real candidates ----
  const listing = candidates.map(candidateCard).join("\n");
  const user = `کالای موردعلاقهٔ کاربر: ${validIdent.label}\n\nمحصولات هومینو:\n${listing}`;
  const rawRank = await visionCall(SCAN_RANK_SYSTEM, user, image);
  const ranked = parseJson<{ matches?: { id?: string; score?: number; reason?: string }[] }>(rawRank);

  const byId = new Map(candidates.map((p) => [p.id, p]));
  const matches: ScanMatch[] = [];
  if (ranked?.matches?.length) {
    for (const m of ranked.matches) {
      const p = typeof m.id === "string" ? byId.get(m.id) : undefined;
      if (!p || matches.some((x) => x.id === p.id)) continue; // never trust an invented id
      matches.push(toMatch(p, clampScore(m.score), String(m.reason ?? localReason(p, validIdent))));
      if (matches.length >= MAX_MATCHES) break;
    }
  }
  // Top up from the deterministic order so the list is never empty.
  for (const c of scored) {
    if (matches.length >= MAX_MATCHES) break;
    if (matches.some((m) => m.id === c.p.id)) continue;
    matches.push(toMatch(c.p, c.s, localReason(c.p, validIdent)));
  }

  return {
    visionAvailable: true,
    identified: validIdent,
    matches,
  };
}
