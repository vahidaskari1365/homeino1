// ============================================================
// Product-aware advice engine — the brain behind the PDP
// «هومینو استودیو برای این محصول» quick questions and any
// pairing/color/style question asked while a product is open.
//
// Every answer is built from REAL catalog data (product colors,
// styleSlugs, style editorial palettes, style-overlap scoring)
// and kept SHORT — the customer should reach the decision fast,
// exactly like a skilled interior-design salesperson.
// No network, no fabrication: unknown product → null (caller
// falls back to the normal chat chain).
//
// Two data modes share the SAME pure core (buildAdviceFor):
//   • buildProductAdvice        → static shipped catalog (client fallback)
//   • productAdviceServer.ts    → live database catalog (server, preferred)
// ============================================================
import { getProduct, getProductById, similarProducts } from "@/data/products";
import { styles as staticStyles } from "@/data/styles";
import { scoreSimilarProducts } from "@/lib/similarProducts";
import type { Product, Style } from "@/types";

export type AdviceTopic = "pair" | "color" | "style";

/** Minimal card shape matching the AIPanel product cards. */
export interface AdviceCard {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  url: string;
}

/** Injected catalog context — the pure core never imports data itself. */
export interface AdviceDataContext {
  styles: Style[];
  similar: Product[];
}

/** Topic detection tuned to the exact PDP chip texts + free-typed variants.
 *  Order matters: «چه رنگی کنار این مناسب است؟» contains both «رنگ» and
 *  «مناسب» — color must win before the generic «مناسب» pairing regex. */
export function detectAdviceTopic(text: string): AdviceTopic | null {
  if (/رنگ|color|پالت/.test(text)) return "color";
  if (/سبک|style|مینیمال|مدرن|کلاسیک|اسکاندیناوی|ژاپندی|جاپاندی|صنعتی|بوهو|روستیک|مدیترانه|نئوکلاسیک|آرت دکو|معاصر/.test(text)) return "style";
  if (/ست|هماهنگ|ترکیب|همخوان|با چه محصولاتی|کنارش|کنار این|جفت/.test(text)) return "pair";
  return null;
}

/** Companion-color roles that always work next to a hero product. */
const NEUTRALS = ["کرم", "سفید", "شنی", "طوسی", "بژ", "استخوانی", "نوک مدادی"];

/** One-phrase selling reason per category slug (short seller language). */
const CATEGORY_ROLES: Record<string, string> = {
  furniture: "هم‌نشینی هم‌سبک",
  decor: "جزئیات و روح فضا",
  lighting: "نور لایه‌ای و گرم",
  rugs: "پایه‌ی زمینی و بافت فضا",
  textiles: "نرمی و بافت فضا",
  tableware: "سرویس و میز آرایی",
  storage: "نظم و سازمان فضا",
  kitchen: "تکمیل آشپزخانه",
  bathroom: "تکمیل سرویس",
};

function resolveStyles(product: Product, styles: Style[]): Style[] {
  return product.styleSlugs
    .map((s) => styles.find((style) => style.slug === s))
    .filter((s): s is Style => Boolean(s));
}

/** Style answer — which style the product belongs to and where it shines. */
function styleAdvice(product: Product, styles: Style[]): string | null {
  const resolved = resolveStyles(product, styles);
  const primary = resolved[0];
  if (!primary) return null;
  const secondary = resolved[1];
  const rooms = primary.suitableRooms?.slice(0, 2).join(" و ");
  const signature = primary.keyFeatures?.[0];
  const parts = [
    `این محصول روح «${primary.name}» دارد${secondary ? ` با ته‌مایه‌ای از ${secondary.name}` : ""}: ${primary.tagline}`,
    rooms ? `بهترین خانه برایش ${rooms} است` : null,
    signature ? `و ${signature} امضای این سبک است` : null,
  ].filter(Boolean);
  return `${parts.join("؛ ")}.`;
}

/** Color answer — grounded in the product's own colors + its style palette. */
function colorAdvice(product: Product, styles: Style[]): string | null {
  const own = product.colors.map((c) => c.name).filter(Boolean);
  const style = resolveStyles(product, styles)[0];
  const companion =
    style?.colorPalette.find((c) => !own.includes(c.name) && !NEUTRALS.some((n) => c.name.includes(n))) ??
    style?.colorPalette[0];
  const ownText = own.length ? own.join(" و ") : null;
  const parts = [
    ownText ? `پایه‌ی رنگی این محصول ${ownText} است` : null,
    companion ? `کنارش «${companion.name}» از پالت سبک ${style?.name} خیلی خوب می‌نشیند` : null,
    `برای تعادل هم یک پایه‌ی خنثی (کرم یا طوسی روشن) اضافه کن تا همین محصول قهرمان فضا بماند`,
  ].filter(Boolean);
  return parts.length >= 2 ? `${parts.join("؛ ")}.` : null;
}

/** Pairing answer — real complementary products scored by style overlap. */
function pairAdvice(product: Product, similar: Product[]): { text: string; products: AdviceCard[] } | null {
  // Complementary = different sub-category (a sofa pairs with a rug, not another sofa).
  const complementary = similar.filter(
    (p) => p.id !== product.id && (p.categorySlug !== product.categorySlug || (p.subCategorySlug ?? "") !== (product.subCategorySlug ?? "-")),
  );
  // One pick per category → a balanced trio, best-scored first.
  const picks: Product[] = [];
  const seen = new Set<string>();
  for (const p of complementary) {
    if (seen.has(p.categorySlug)) continue;
    seen.add(p.categorySlug);
    picks.push(p);
    if (picks.length === 3) break;
  }
  if (!picks.length) return null;

  const items = picks.map((p) => {
    const role = CATEGORY_ROLES[p.categorySlug] ?? "تکمیل‌کننده‌ی هم‌سبک";
    return `«${p.name}» (${role})`;
  });
  const text = `برای «${product.name}» این‌ها ستِ کامل و بی‌دردسری می‌سازند: ${items.join("، ")}. همه هم‌سبکِ همین محصول‌اند و کنارش فضا یکدست تمام می‌شود.`;
  const products: AdviceCard[] = picks.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    image: p.images?.[0],
    url: `/products/${p.slug}`,
  }));
  return { text, products };
}

/** The pure core: a grounded answer for a topic + product + injected data. */
export function buildAdviceFor(
  topic: AdviceTopic,
  product: Product,
  data: AdviceDataContext,
): { text: string; products?: AdviceCard[] } | null {
  if (topic === "style") {
    const text = styleAdvice(product, data.styles);
    return text ? { text } : null;
  }
  if (topic === "color") {
    const text = colorAdvice(product, data.styles);
    return text ? { text } : null;
  }
  return pairAdvice(product, data.similar);
}

/** Static-catalog fallback (client-side, offline-safe). The server path in
 *  productAdviceServer.ts is preferred — it reads the LIVE database. */
export function buildProductAdvice(
  topic: AdviceTopic,
  slugOrId: string,
): { text: string; products?: AdviceCard[] } | null {
  const product = getProduct(slugOrId) ?? getProductById(slugOrId);
  if (!product) return null;
  return buildAdviceFor(topic, product, {
    styles: staticStyles,
    similar: similarProducts(product.id, 12),
  });
}

/** Re-exported for callers that want to rescore a fresh pool themselves. */
export { scoreSimilarProducts };
