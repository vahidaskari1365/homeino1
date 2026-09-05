// ============================================================
// Product-aware advice engine — the brain behind the PDP
// «هوش مصنوعی برای این محصول» quick questions and any
// pairing/color/style question asked while a product is open.
//
// Every answer is built from REAL catalog data (product colors,
// styleSlugs, style editorial palettes, style-overlap scoring)
// and kept SHORT — the customer should reach the decision fast,
// exactly like a skilled interior-design salesperson.
// No network, no fabrication: unknown product → null (caller
// falls back to the normal chat chain).
// ============================================================
import { getProduct, getProductById, similarProducts } from "@/data/products";
import { getStyle } from "@/data/styles";
import type { Product } from "@/types";

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

function resolveProduct(slugOrId: string): Product | undefined {
  return getProduct(slugOrId) ?? getProductById(slugOrId);
}

/** Style answer — which style the product belongs to and where it shines. */
function styleAdvice(product: Product): string | null {
  const styles = product.styleSlugs.map((s) => getStyle(s)).filter((s) => Boolean(s));
  const primary = styles[0];
  if (!primary) return null;
  const secondary = styles[1];
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
function colorAdvice(product: Product): string | null {
  const own = product.colors.map((c) => c.name).filter(Boolean);
  const style = product.styleSlugs.map((s) => getStyle(s)).find((s) => Boolean(s));
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
function pairAdvice(product: Product): { text: string; products: AdviceCard[] } | null {
  const scored = similarProducts(product.id, 12);
  // Complementary = different sub-category (a sofa pairs with a rug, not another sofa).
  const complementary = scored.filter(
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

/** Build a grounded answer for a topic + product. null → caller falls back. */
export function buildProductAdvice(
  topic: AdviceTopic,
  slugOrId: string,
): { text: string; products?: AdviceCard[] } | null {
  const product = resolveProduct(slugOrId);
  if (!product) return null;
  if (topic === "style") {
    const text = styleAdvice(product);
    return text ? { text } : null;
  }
  if (topic === "color") {
    const text = colorAdvice(product);
    return text ? { text } : null;
  }
  return pairAdvice(product);
}
