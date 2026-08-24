// ============================================================
// HOMEINO AI — REAL PRODUCT RESOLUTION + STORE MATCHING
//
// Pure module (no I/O). Callers pass a real catalog — the matcher
// NEVER invents products, prices, SKUs, stores, or URLs.
//
// Resolution flow:
//   SKU / Product Code → catalog lookup → real product → AI context
//
// Matching priority (spec §12):
//   1. exact SKU
//   2. exact product id
//   3. category
//   4. style compatibility
//   5. color compatibility
//   6. category + room compatibility
//
// Product matching MUST NOT re-run image generation or mutate
// the generated image / engine prompt.
// ============================================================

import type { RoomElement } from "./roomState";

export const INVALID_SKU_MESSAGE =
  "این کد محصول در کاتالوگ Homeino پیدا نشد.\nلطفاً کد محصول را بررسی کنید.";

export const CATEGORY_SKU_CONFLICT_MESSAGE =
  "کد محصول مربوط به دستهٔ دیگری است. لطفاً دسته را با کد محصول هماهنگ کنید.";

/** Catalog row the matcher is allowed to read. All fields optional except id. */
export interface MatchableProduct {
  id: string;
  sku?: string;
  productCode?: string;
  name?: string;
  slug?: string;
  category?: string;
  categorySlug?: string;
  subCategorySlug?: string;
  storeId?: string;
  brand?: string;
  images?: string[];
  price?: number;
  currency?: string;
  inStock?: boolean;
  styleSlugs?: string[];
  colors?: Array<string | { name: string; hex?: string }>;
  materials?: string[];
  tags?: string[];
  dimensions?: string | { width?: number; height?: number; depth?: number };
}

export interface CatalogOffer {
  productId: string;
  storeId: string;
  price?: number;
  inStock?: boolean;
  sellerSku?: string;
}

export interface CatalogStore {
  id: string;
  name: string;
  slug?: string;
}

export interface ResolvedProduct {
  id: string;
  sku?: string;
  name?: string;
  category?: string;
  storeId?: string;
  image?: string;
  slug?: string;
  material?: string;
  color?: string;
  style?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
}

export type ProductResolutionStatus = "ok" | "not_found" | "conflict" | "empty";

export interface ProductResolution {
  status: ProductResolutionStatus;
  product?: ResolvedProduct;
  selectedTarget?: RoomElement;
  productTarget?: RoomElement;
  message?: string;
}

export type MatchReason = "sku" | "product" | "category" | "style" | "color" | "room";

/** One real store/catalog hit shown under a generated image. */
export interface StoreProductMatch {
  productId: string;
  matchReason: MatchReason;
  score: number;
  sku?: string;
  name?: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: boolean;
  productUrl?: string;
  category?: string;
  storeId?: string;
  storeName?: string;
}

export interface MatchStoreProductsInput {
  catalog: MatchableProduct[];
  stores?: CatalogStore[];
  offers?: CatalogOffer[];
  sku?: string;
  productId?: string;
  targets?: RoomElement[];
  style?: string;
  colors?: string[];
  room?: string;
  roomAnalysis?: {
    roomType?: string;
    furnitureTypes?: string[];
    emptySpaces?: string[];
  };
  maxResults?: number;
}

// ------------------------------------------------------------
// Taxonomy mapping — uses EXISTING RoomElement vocabulary only.
// "decor" → art, "wardrobe" → shelf. No new taxonomy.
// ------------------------------------------------------------

const LABEL_TABLE: { keys: string[]; target: RoomElement }[] = [
  { keys: ["sofa", "couch", "sectional", "مبل", "کاناپه", "پوف", "pouf"], target: "sofa" },
  { keys: ["chair", "armchair", "صندلی"], target: "chair" },
  { keys: ["table", "desk", "dining", "میز", "ناهارخوری"], target: "table" },
  { keys: ["rug", "carpet", "فرش", "قالی", "گلیم"], target: "rug" },
  { keys: ["lighting", "light", "lamp", "چراغ", "لوستر", "آباژور", "نورپردازی", "دیوارکوب"], target: "lighting" },
  { keys: ["curtain", "drape", "پرده"], target: "curtain" },
  { keys: ["bed", "bedding", "تخت"], target: "bed" },
  { keys: ["wardrobe", "closet", "کمد"], target: "shelf" },
  { keys: ["decor", "accessory", "accessories", "دکور", "اکسسوری"], target: "art" },
  { keys: ["art", "mirror", "تابلو", "آینه"], target: "art" },
  { keys: ["plant", "plants", "گیاه", "گلدان"], target: "plant" },
  { keys: ["tv", "console", "تلویزیون", "کنسول"], target: "tv" },
  { keys: ["shelf", "bookcase", "قفسه", "شلف"], target: "shelf" },
  { keys: ["furniture", "مبلمان"], target: "sofa" },
];

const SLUG_TO_TARGET: Record<string, RoomElement> = {
  furniture: "sofa",
  dining: "table",
  curtain: "curtain",
  textiles: "curtain",
  carpet: "rug",
  rugs: "rug",
  lighting: "lighting",
  "tv-console": "tv",
  "bookcase-shoe": "shelf",
  bedding: "bed",
  bedroom: "bed",
  plants: "plant",
  plant: "plant",
  art: "art",
  decor: "art",
  accessories: "art",
  office: "table",
  workspace: "table",
  sofa: "sofa",
  chair: "chair",
  table: "table",
  rug: "rug",
  bed: "bed",
  wardrobe: "shelf",
};

const SUBTYPE_TO_TARGET: Record<string, RoomElement> = {
  "صندلی راحتی": "chair",
  "صندلی ارگونومیک": "chair",
  "میز اداری": "table",
  "میز و صندلی دسته دوم": "table",
  "فرش دسته دوم": "rug",
  "نورپردازی دسته دوم": "lighting",
  "دکور دسته دوم": "art",
};

export function normalizeSku(value: string): string {
  return String(value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

/** Map a UI label / English category / Persian name onto the existing taxonomy. */
export function mapLabelToTarget(raw: string): RoomElement | undefined {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return undefined;
  if (SLUG_TO_TARGET[t]) return SLUG_TO_TARGET[t];
  if (SUBTYPE_TO_TARGET[raw.trim()] || SUBTYPE_TO_TARGET[t]) {
    return SUBTYPE_TO_TARGET[raw.trim()] ?? SUBTYPE_TO_TARGET[t];
  }
  // Longest key wins so «چراغ رومیزی» maps to lighting, not table («میز»).
  let best: { target: RoomElement; len: number } | undefined;
  for (const { keys, target } of LABEL_TABLE) {
    for (const k of keys) {
      if (t === k || t.includes(k)) {
        if (!best || k.length > best.len) best = { target, len: k.length };
      }
    }
  }
  return best?.target;
}

/** UI category / subtype / English name → RoomElement[] (existing taxonomy). */
export function mapUiSelectionToTargets(selection: {
  slugs?: string[];
  labels?: string[];
  names?: string[];
}): RoomElement[] {
  const fromLabels = new Set<RoomElement>();
  for (const item of [...(selection.labels ?? []), ...(selection.names ?? [])]) {
    const target = mapLabelToTarget(item);
    if (target) fromLabels.add(target);
  }
  // Prefer specific subtype/name mappings (chair vs sofa) over generic slugs.
  if (fromLabels.size > 0) return [...fromLabels];
  const fromSlugs = new Set<RoomElement>();
  for (const item of selection.slugs ?? []) {
    const target = mapLabelToTarget(item);
    if (target) fromSlugs.add(target);
  }
  return [...fromSlugs];
}

export function categoryToTarget(product: {
  category?: string;
  categorySlug?: string;
  subCategorySlug?: string;
  name?: string;
}): RoomElement | undefined {
  const slug = (product.categorySlug ?? product.category ?? "").trim().toLowerCase();
  const slugTarget = SLUG_TO_TARGET[slug];
  // Specific catalog slugs (lighting, bedroom, rugs…) win over name heuristics.
  if (slugTarget && slug !== "furniture") return slugTarget;
  // Prefer the most specific field so "furniture + chair" stays chair, not sofa.
  return (
    mapLabelToTarget(product.subCategorySlug ?? "") ||
    mapLabelToTarget(product.name ?? "") ||
    slugTarget ||
    mapLabelToTarget(slug)
  );
}

export function toMatchableProduct(
  p: {
    id: string;
    sku?: string;
    slug?: string;
    name?: string;
    categorySlug?: string;
    subCategorySlug?: string;
    storeId?: string;
    brand?: string;
    images?: string[];
    price?: number;
    currency?: string;
    inStock?: boolean;
    styleSlugs?: string[];
    colors?: Array<string | { name: string; hex?: string }>;
    materials?: string[];
    tags?: string[];
    dimensions?: string | { width?: number; height?: number; depth?: number };
  },
  skuFallback?: string,
): MatchableProduct {
  return {
    id: p.id,
    sku: p.sku ?? skuFallback,
    slug: p.slug,
    name: p.name,
    category: p.categorySlug,
    categorySlug: p.categorySlug,
    subCategorySlug: p.subCategorySlug,
    storeId: p.storeId,
    brand: p.brand,
    images: p.images,
    price: p.price,
    currency: p.currency,
    inStock: p.inStock,
    styleSlugs: p.styleSlugs,
    colors: p.colors,
    materials: p.materials,
    tags: p.tags,
    dimensions: p.dimensions,
  };
}

export function toResolvedProduct(product: MatchableProduct): ResolvedProduct {
  const out: ResolvedProduct = { id: product.id };
  if (product.sku || product.productCode) out.sku = product.sku ?? product.productCode;
  if (product.name) out.name = product.name;
  if (product.categorySlug || product.category) out.category = product.categorySlug ?? product.category;
  if (product.storeId) out.storeId = product.storeId;
  if (product.images?.[0]) out.image = product.images[0];
  if (product.slug) out.slug = product.slug;
  if (product.materials?.[0]) out.material = product.materials[0];
  const color = firstColorName(product.colors);
  if (color) out.color = color;
  if (product.styleSlugs?.[0]) out.style = product.styleSlugs[0];
  if (typeof product.price === "number") out.price = product.price;
  if (product.currency) out.currency = product.currency;
  if (typeof product.inStock === "boolean") out.inStock = product.inStock;
  return out;
}

function firstColorName(colors?: MatchableProduct["colors"]): string | undefined {
  if (!colors?.length) return undefined;
  const first = colors[0];
  return typeof first === "string" ? first : first.name;
}

function findInCatalog(
  catalog: MatchableProduct[],
  code: string,
  extraCodes?: { sku: string; productId: string }[],
): MatchableProduct | undefined {
  const n = normalizeSku(code);
  if (!n) return undefined;
  const extraId = extraCodes?.find((c) => normalizeSku(c.sku) === n)?.productId;
  return catalog.find((p) => {
    if (normalizeSku(p.sku ?? "") === n) return true;
    if (normalizeSku(p.productCode ?? "") === n) return true;
    if (normalizeSku(p.id) === n) return true;
    if (normalizeSku(p.slug ?? "") === n) return true;
    if (extraId && p.id === extraId) return true;
    return false;
  });
}

/**
 * Resolve a user-entered Product Code / SKU against a REAL catalog.
 * Never fabricates a product when the code is missing.
 */
export function resolveProductCode(
  code: string | undefined,
  catalog: MatchableProduct[],
  opts?: {
    selectedTargets?: RoomElement[];
    extraCodes?: { sku: string; productId: string }[];
  },
): ProductResolution {
  const raw = String(code ?? "").trim();
  if (!raw) return { status: "empty" };

  const product = findInCatalog(catalog, raw, opts?.extraCodes);
  if (!product) {
    return { status: "not_found", message: INVALID_SKU_MESSAGE };
  }

  const productTarget = categoryToTarget(product);
  const selected = (opts?.selectedTargets ?? []).filter(Boolean);
  if (productTarget && selected.length > 0 && !selected.includes(productTarget)) {
    return {
      status: "conflict",
      product: toResolvedProduct(product),
      selectedTarget: selected[0],
      productTarget,
      message: CATEGORY_SKU_CONFLICT_MESSAGE,
    };
  }

  return {
    status: "ok",
    product: toResolvedProduct(product),
    productTarget,
  };
}

// ------------------------------------------------------------
// Matching
// ------------------------------------------------------------

const ELEMENT_CATALOG_SLUGS: Record<RoomElement, string[]> = {
  sofa: ["furniture"],
  chair: ["furniture"],
  table: ["furniture", "workspace"],
  rug: ["rugs"],
  curtain: ["textiles"],
  lighting: ["lighting"],
  wall: ["decor"],
  floor: ["rugs"],
  ceiling: ["lighting"],
  tv: ["furniture"],
  plant: ["decor", "outdoor"],
  art: ["decor"],
  door: [],
  window: [],
  shelf: ["furniture"],
  bed: ["bedroom"],
};

const ROOM_CATEGORY_SLUGS: Record<string, string[]> = {
  living: ["furniture", "rugs", "lighting", "textiles", "decor"],
  "پذیرایی": ["furniture", "rugs", "lighting", "textiles", "decor"],
  "نشیمن": ["furniture", "rugs", "lighting", "textiles", "decor"],
  bedroom: ["bedroom", "textiles", "lighting", "decor"],
  "خواب": ["bedroom", "textiles", "lighting", "decor"],
  "اتاق خواب": ["bedroom", "textiles", "lighting", "decor"],
  kitchen: ["kitchen"],
  "آشپزخانه": ["kitchen"],
  office: ["workspace", "lighting", "furniture"],
  "اداری": ["workspace", "lighting", "furniture"],
  "فضای اداری": ["workspace", "lighting", "furniture"],
  dining: ["furniture", "lighting", "rugs"],
  "ناهارخوری": ["furniture", "lighting", "rugs"],
};

const STYLE_ALIASES: Record<string, string> = {
  modern: "modern",
  مدرن: "modern",
  classic: "classic",
  کلاسیک: "classic",
  minimalist: "minimal",
  minimal: "minimal",
  مینیمال: "minimal",
  scandinavian: "scandinavian",
  اسکاندیناوی: "scandinavian",
  industrial: "industrial",
  صنعتی: "industrial",
  bohemian: "boho",
  boho: "boho",
  بوهمی: "boho",
  japanese: "japandi",
  japandi: "japandi",
  ژاپندی: "japandi",
  luxury: "contemporary",
  لوکس: "contemporary",
  office: "modern",
};

const COLOR_ALIASES: Record<string, string[]> = {
  کرم: ["کرم", "cream", "beige", "sand", "شنی"],
  cream: ["کرم", "cream", "beige", "sand", "شنی"],
  سفید: ["سفید", "white"],
  white: ["سفید", "white"],
  طوسی: ["طوسی", "gray", "grey", "ذغالی", "charcoal"],
  سبز: ["سبز", "sage", "green"],
  آبی: ["آبی", "navy", "blue"],
};

function productCategorySlug(p: MatchableProduct): string {
  return (p.categorySlug || p.category || "").toLowerCase();
}

function styleKey(value?: string): string | undefined {
  if (!value) return undefined;
  const k = value.trim().toLowerCase();
  return STYLE_ALIASES[k] ?? k.replace(/\s+/g, "-");
}

function colorMatches(product: MatchableProduct, wanted: string[]): boolean {
  if (!wanted.length) return false;
  const have = (product.colors ?? []).map((c) => (typeof c === "string" ? c : c.name).toLowerCase());
  if (!have.length) return false;
  return wanted.some((w) => {
    const aliases = COLOR_ALIASES[w] ?? COLOR_ALIASES[w.toLowerCase()] ?? [w];
    return aliases.some((a) => have.some((h) => h.includes(a.toLowerCase()) || a.toLowerCase().includes(h)));
  });
}

function categoryMatchesTarget(product: MatchableProduct, targets: RoomElement[]): boolean {
  if (!targets.length) return false;
  const slug = productCategorySlug(product);
  const productTarget = categoryToTarget(product);
  if (productTarget && targets.includes(productTarget)) return true;
  return targets.some((t) => (ELEMENT_CATALOG_SLUGS[t] ?? []).includes(slug));
}

function roomCompatible(product: MatchableProduct, room?: string): boolean {
  if (!room) return false;
  const slugs = ROOM_CATEGORY_SLUGS[room] ?? ROOM_CATEGORY_SLUGS[room.toLowerCase()];
  if (!slugs) return false;
  return slugs.includes(productCategorySlug(product));
}

function storeNameOf(storeId: string | undefined, stores?: CatalogStore[]): string | undefined {
  if (!storeId) return undefined;
  return stores?.find((s) => s.id === storeId)?.name;
}

function compactMatch(fields: StoreProductMatch): StoreProductMatch {
  const out: StoreProductMatch = {
    productId: fields.productId,
    matchReason: fields.matchReason,
    score: fields.score,
  };
  if (fields.sku) out.sku = fields.sku;
  if (fields.name) out.name = fields.name;
  if (fields.image) out.image = fields.image;
  if (typeof fields.price === "number") out.price = fields.price;
  if (fields.currency) out.currency = fields.currency;
  if (typeof fields.availability === "boolean") out.availability = fields.availability;
  if (fields.productUrl) out.productUrl = fields.productUrl;
  if (fields.category) out.category = fields.category;
  if (fields.storeId) out.storeId = fields.storeId;
  if (fields.storeName) out.storeName = fields.storeName;
  return out;
}

function rowFromProduct(
  product: MatchableProduct,
  reason: MatchReason,
  score: number,
  stores?: CatalogStore[],
  offer?: CatalogOffer,
): StoreProductMatch {
  const storeId = offer?.storeId ?? product.storeId;
  return compactMatch({
    productId: product.id,
    matchReason: reason,
    score,
    sku: offer?.sellerSku ?? product.sku ?? product.productCode,
    name: product.name,
    image: product.images?.[0],
    price: typeof offer?.price === "number" ? offer.price : product.price,
    currency: product.currency,
    availability: typeof offer?.inStock === "boolean" ? offer.inStock : product.inStock,
    productUrl: product.slug ? `/products/${product.slug}` : undefined,
    category: product.categorySlug ?? product.category,
    storeId,
    storeName: storeNameOf(storeId, stores),
  });
}

function scoreProduct(
  product: MatchableProduct,
  input: MatchStoreProductsInput,
): { score: number; reason: MatchReason } {
  const sku = input.sku ? normalizeSku(input.sku) : "";
  if (sku) {
    if (normalizeSku(product.sku ?? "") === sku || normalizeSku(product.productCode ?? "") === sku) {
      return { score: 1000, reason: "sku" };
    }
  }
  if (input.productId && product.id === input.productId) {
    return { score: 900, reason: "product" };
  }

  let score = 0;
  let reason: MatchReason = "room";
  const targets = input.targets ?? [];

  // Named category (bed, sofa, …) must not dump every room-compatible product.
  if (targets.length && !categoryMatchesTarget(product, targets)) {
    return { score: 0, reason: "room" };
  }

  if (categoryMatchesTarget(product, targets)) {
    score += 400;
    reason = "category";
  }

  const wantedStyle = styleKey(input.style);
  if (wantedStyle && (product.styleSlugs ?? []).some((s) => styleKey(s) === wantedStyle)) {
    score += 200;
    if (reason !== "category") reason = "style";
  }

  if (colorMatches(product, input.colors ?? [])) {
    score += 100;
    if (score < 400) reason = "color";
  }

  const room = input.roomAnalysis?.roomType ?? input.room;
  if (roomCompatible(product, room)) {
    score += 50;
    if (score < 200) reason = "room";
  }

  if (input.roomAnalysis?.furnitureTypes?.length) {
    const productTarget = categoryToTarget(product);
    if (productTarget && input.roomAnalysis.furnitureTypes.includes(productTarget)) score += 30;
  }

  if (product.inStock) score += 20;
  return { score, reason };
}

/**
 * Rank real catalog products for display under a generated image.
 * Does not invent rows. Does not look at / mutate the generated image.
 */
export function matchStoreProducts(input: MatchStoreProductsInput): StoreProductMatch[] {
  const catalog = input.catalog.filter((p) => Boolean(p?.id));
  if (!catalog.length) return [];

  const max = Math.max(1, Math.min(24, input.maxResults ?? 8));
  const scored = catalog
    .map((product) => {
      const { score, reason } = scoreProduct(product, input);
      return { product, score, reason };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));

  const out: StoreProductMatch[] = [];
  const seen = new Set<string>();

  for (const row of scored) {
    const productOffers = (input.offers ?? []).filter((o) => o.productId === row.product.id);
    if (productOffers.length) {
      // Multi-store: one row per real offer, still sorted by relevance then store id.
      const offers = [...productOffers].sort((a, b) => {
        const avail = Number(b.inStock !== false) - Number(a.inStock !== false);
        if (avail !== 0) return avail;
        return (a.storeId ?? "").localeCompare(b.storeId ?? "");
      });
      for (const offer of offers) {
        const key = `${row.product.id}:${offer.storeId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(rowFromProduct(row.product, row.reason, row.score, input.stores, offer));
        if (out.length >= max) return out;
      }
    } else {
      const key = `${row.product.id}:${row.product.storeId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rowFromProduct(row.product, row.reason, row.score, input.stores));
      if (out.length >= max) return out;
    }
  }

  return out;
}

/**
 * Post-generation matching. The generated image is accepted only so
 * callers can keep it in one object — it is NEVER used to invent
 * products and MUST NOT be rewritten.
 */
export function matchAfterGeneration(
  input: MatchStoreProductsInput & { generatedImage?: string },
): StoreProductMatch[] {
  void input.generatedImage;
  return matchStoreProducts(input);
}

export function assertRealCatalogIds(matches: StoreProductMatch[], catalog: MatchableProduct[]): void {
  const ids = new Set(catalog.map((p) => p.id));
  for (const match of matches) {
    if (!ids.has(match.productId)) {
      throw new Error(`invented product id: ${match.productId}`);
    }
  }
}
