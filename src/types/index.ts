// ============================================================
// HOMEINO — Frontend domain models
// Designed to map cleanly onto a future DB / Supabase schema.
// ============================================================

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  description?: string;
  icon: string; // lucide icon name
  image: string;
  subcategories: SubCategory[];
  productCount: number;
}

export interface SubCategory {
  id: string;
  slug: string;
  name: string;
}

export type StyleSlug =
  | "modern"
  | "minimal"
  | "scandinavian"
  | "classic"
  | "neoclassical"
  | "industrial"
  | "boho"
  | "rustic"
  | "japandi"
  | "mediterranean"
  | "contemporary"
  | "art-deco";

export interface StyleColor {
  name: string;
  hex: string;
}

/**
 * Editorial style model. It is deliberately backend-friendly: every field is
 * serializable and can map directly to a Supabase row plus related arrays.
 */
export interface Style {
  id: string;
  slug: StyleSlug;
  name: string;
  nameEn: string;
  tagline: string;
  shortDescription: string;
  description: string;
  image: string;
  imageAlt: string;
  colorPalette: StyleColor[];
  materials: string[];
  keyFeatures: string[];
  furnitureCharacteristics: string;
  lightingCharacteristics: string;
  formCharacteristics: string;
  decorCharacteristics: string;
  visualDensity: string;
  suitableFor: string;
  suitableRooms: string[];
  comparisonNote?: string;
}

/** Backwards-compatible domain name used by existing storefront modules. */
export type DecorStyle = Style;

export interface Store {
  id: string;
  slug: string;
  name: string;
  logo: string; // emoji or initial block
  logoColor: string;
  cover: string;
  description: string;
  rating: number;
  reviewsCount: number;
  productCount: number;
  city: string;
  verified: boolean;
  trending: boolean;
  isNew: boolean;
  categorySlugs: string[];
  // ---- Marketplace trust & policy (frontend-ready — backend TBD) ----
  salesCount: number;     // تعداد فروش موفق
  followersCount: number; // دنبال‌کننده‌ها
  sinceYear: number;      // سال آغاز فعالیت
  responseTime: string;   // زمان پاسخگویی
  badges: string[];       // e.g. ["پرفروش", "ارسال سریع"]
  shippingPolicy: string; // سیاست ارسال
  returnPolicy: string;   // سیاست بازگشت
}

/**
 * Storefront-only information. Kept separate from Store so the current mock
 * layer can later be replaced by a vendor profile API without changing UI.
 */
export interface StorefrontProfile {
  storeId: string;
  joinedAt: string;
  fulfilledOrders: number;
  responseRate: number;
  responseTime: string;
  dispatchTime: string;
  shippingCoverage: string;
  shippingNote: string;
  returnDays: number;
  returnNote: string;
  authenticityNote: string;
}

export interface StoreReview {
  id: string;
  storeId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  verifiedPurchase: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
}

// ============================================================
// MULTI-VENDOR MARKETPLACE: Product → Offer → Store
// ============================================================

/** A store's offer for a given product. Multiple stores can offer
 *  the same Product at different prices, stock, and shipping terms. */
export interface Offer {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  oldPrice?: number;
  stock: number;
  inStock: boolean;
  shippingCost: number;
  shippingDays: string;       // e.g. "۲ تا ۵ روز"
  sellerSku: string;
  condition: "new" | "second-hand";
  isFeatured?: boolean;       // promoted listing
}

/** Seller/Vendor entity (links to Store) */
export interface Seller {
  id: string;
  storeId: string;
  commissionRate: number;     // e.g. 0.08 = 8%
  status: "active" | "pending" | "suspended";
  joinedAt: string;
  totalSales: number;
  payoutBalance: number;      // unsettled earnings
  rating: number;
}

/** Future: commission, payout, settlement, refund */
export interface CommissionRecord {
  id: string;
  orderId: string;
  sellerId: string;
  orderTotal: number;
  commissionRate: number;
  commissionAmount: number;
  sellerPayout: number;
  status: "pending" | "settled" | "refunded";
  createdAt: string;
  settledAt?: string;
}

export interface Product {
  id: string;
  slug: string;
  sku?: string;
  name: string;
  brand: string;
  storeId: string;
  categorySlug: string;
  subCategorySlug?: string;
  styleSlugs: StyleSlug[];
  price: number;
  oldPrice?: number;
  currency: "تومان";
  rating: number;
  reviewsCount: number;
  purchaseCount: number;
  images: string[];
  colors: { name: string; hex: string }[];
  materials: string[];
  dimensions?: string;
  description: string;
  specs: ProductSpec[];
  inStock: boolean;
  stockCount: number;
  trending?: boolean;
  aiRecommended?: boolean;
  isNew?: boolean;
  discount?: number;
  tags: string[];
  salesCount?: number; // تعداد خرید این محصول (mock — جایگزین با API واقعی)
}

export interface InspirationImage {
  id: string;
  title: string;
  image: string;
  styleSlug: StyleSlug;
  room: string;
  tags: string[];
  liked?: boolean;
  // products featured inside this design
  productIds: string[];
  // ---- Pinterest-style pin metadata (optional so legacy seed data stays valid) ----
  description?: string;   // full Persian description of the layout
  items?: string[];       // items used (Persian names)
  styleNote?: string;     // explanation of the style in this pin
  source?: { label: string; url?: string };  // inspiration source credit
  author?: { name: string; type: "editorial" | "agent" | "user" };
  createdAt?: string;     // ISO date
}

export interface Collection {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  count: number;
}

export type AiMode =
  | "room-redesign"
  | "prompt-to-design"
  | "image-edit"
  | "product-in-room"
  | "decor-suggest"
  | "full-concept";

export interface AiDesign {
  id: string;
  mode: AiMode;
  title: string;
  prompt: string;
  style?: string;
  room?: string;
  beforeImage?: string;
  afterImage: string;
  status: "completed" | "processing" | "failed";
  createdAt: string;
  creditsUsed: number;
  products: { label: string; productId?: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  pending?: boolean;
  /** Real catalog products attached to an assistant reply (rendered as cards). */
  products?: {
    id: string;
    name: string;
    price: number;
    currency: string;
    image?: string;
    url: string;
    storeName?: string;
  }[];
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  helpful: number;
}

// ---- Cart ----
export interface CartItem {
  productId: string;
  /** Selected marketplace offer. Optional for products with one default store. */
  offerId?: string;
  qty: number;
}

export interface UserCollection {
  id: string;
  title: string;
  description?: string;
  productIds: string[];
  createdAt: string;
}

// ---- Second-hand listing ----
export interface SecondHandProduct {
  id: string;
  slug: string;
  title: string;
  category: string;
  categoryLabel: string;
  price: number;
  originalPrice?: number;
  condition: "نو" | "خوب" | "قابل‌قبول";
  city: string;
  sellerName: string;
  image: string;
  description: string;
  age: string; // مدت استفاده
  reason: string; // دلیل فروش
  status: "active" | "sold";
  createdAt: string;
}

// ---- AI credits ----
export interface CreditTransaction {
  id: string;
  amount: number; // negative = spent
  reason: string;
  date: string;
}
