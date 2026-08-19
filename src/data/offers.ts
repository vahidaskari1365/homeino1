import type { Offer } from "@/types";

// ============================================================
// MOCK OFFERS — multiple stores offering the same products.
// In production, this comes from the backend marketplace API.
// AI and UI use getBestOffer() to find the cheapest/ fastest.
// ============================================================

export const offers: Offer[] = [
  // p1 — کاناپه هلیم
  { id: "of1a", productId: "p1", storeId: "st1", price: 48500000, oldPrice: 62000000, stock: 8, inStock: true, shippingCost: 0, shippingDays: "۳ تا ۷ روز", sellerSku: "NM-HE-3P", condition: "new", isFeatured: true },
  { id: "of1b", productId: "p1", storeId: "st10", price: 46900000, oldPrice: 59000000, stock: 3, inStock: true, shippingCost: 250000, shippingDays: "۵ تا ۱۰ روز", sellerSku: "AT-HE-3P", condition: "new" },
  { id: "of1c", productId: "p1", storeId: "st7", price: 49900000, stock: 5, inStock: true, shippingCost: 0, shippingDays: "۲ تا ۵ روز", sellerSku: "AR-HE-3P", condition: "new" },

  // p9 — چراغ رومیزی چوبی
  { id: "of9a", productId: "p9", storeId: "st3", price: 3900000, oldPrice: 5200000, stock: 30, inStock: true, shippingCost: 80000, shippingDays: "۱ تا ۳ روز", sellerSku: "LU-WL-MN", condition: "new", isFeatured: true },
  { id: "of9b", productId: "p9", storeId: "st10", price: 3650000, oldPrice: 4800000, stock: 12, inStock: true, shippingCost: 120000, shippingDays: "۳ تا ۶ روز", sellerSku: "AT-WL-MN", condition: "new" },
  { id: "of9c", productId: "p9", storeId: "st2", price: 4100000, stock: 0, inStock: false, shippingCost: 0, shippingDays: "ناموجود", sellerSku: "CH-WL-MN", condition: "new" },

  // p12 — قالیچه بربری
  { id: "of12a", productId: "p12", storeId: "st4", price: 9800000, oldPrice: 13000000, stock: 6, inStock: true, shippingCost: 150000, shippingDays: "۲ تا ۵ روز", sellerSku: "FS-BR-200", condition: "new", isFeatured: true },
  { id: "of12b", productId: "p12", storeId: "st10", price: 9200000, stock: 4, inStock: true, shippingCost: 200000, shippingDays: "۴ تا ۸ روز", sellerSku: "AT-BR-200", condition: "new" },

  // p15 — ست کوسن
  { id: "of15a", productId: "p15", storeId: "st5", price: 1850000, oldPrice: 2400000, stock: 35, inStock: true, shippingCost: 60000, shippingDays: "۱ تا ۳ روز", sellerSku: "NT-CS-4", condition: "new", isFeatured: true },
  { id: "of15b", productId: "p15", storeId: "st1", price: 1750000, stock: 20, inStock: true, shippingCost: 0, shippingDays: "۲ تا ۵ روز", sellerSku: "NM-CS-4", condition: "new" },

  // p33 — مبل ال آوان
  { id: "of33a", productId: "p33", storeId: "st1", price: 62000000, oldPrice: 75000000, stock: 6, inStock: true, shippingCost: 0, shippingDays: "۳ تا ۷ روز", sellerSku: "NM-AV-L", condition: "new", isFeatured: true },
  { id: "of33b", productId: "p33", storeId: "st7", price: 59000000, stock: 2, inStock: true, shippingCost: 300000, shippingDays: "۵ تا ۱۰ روز", sellerSku: "AR-AV-L", condition: "new" },

  // p3 — میز جلو مبلی
  { id: "of3a", productId: "p3", storeId: "st7", price: 7800000, oldPrice: 9500000, stock: 20, inStock: true, shippingCost: 0, shippingDays: "۲ تا ۵ روز", sellerSku: "AR-OK-CT", condition: "new", isFeatured: true },
  { id: "of3b", productId: "p3", storeId: "st1", price: 7600000, stock: 10, inStock: true, shippingCost: 100000, shippingDays: "۳ تا ۶ روز", sellerSku: "NM-OK-CT", condition: "new" },
];

export const offersForProduct = (productId: string): Offer[] =>
  offers.filter((o) => o.productId === productId);

export const getOfferById = (offerId?: string): Offer | undefined =>
  offerId ? offers.find((offer) => offer.id === offerId) : undefined;

export const getBestOffer = (productId: string): Offer | null => {
  const list = offersForProduct(productId).filter((o) => o.inStock);
  if (!list.length) return null;
  // Rank by: lowest effective price (price + shipping), then fastest shipping
  return list.sort((a, b) => {
    const effA = a.price + a.shippingCost;
    const effB = b.price + b.shippingCost;
    if (effA !== effB) return effA - effB;
    return 0;
  })[0];
};

export const getOfferCount = (productId: string): number =>
  offersForProduct(productId).filter((o) => o.inStock).length;
