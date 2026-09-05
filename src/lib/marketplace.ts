import type { CartItem } from "@/types";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { getOfferById } from "@/data/offers";
import { PLATFORM } from "@/config/platform";

/** A cart row resolved against the real catalog + chosen offer. */
export interface CartLine {
  item: CartItem;
  product: NonNullable<ReturnType<typeof getProductById>>;
  offer?: ReturnType<typeof getOfferById>;
  /** store selling this row (offer store, or product home store) */
  storeId: string;
  storeName: string;
  unitPrice: number;
  lineTotal: number;
}

export interface CartParcel {
  storeId: string;
  storeName: string;
  logo: string;
  logoColor: string;
  lines: CartLine[];
  subtotal: number;
  /** ارسال رایگان وقتی جمع مرسوله به آستانه برسد */
  freeShip: boolean;
  shippingCost: number;
  total: number;
}

export function resolveCartLines(items: CartItem[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const item of items) {
    const product = getProductById(item.productId);
    if (!product) continue;
    const offer = item.offerId ? getOfferById(item.offerId) : undefined;
    const storeId = offer?.storeId ?? product.storeId;
    const store = getStoreById(storeId);
    lines.push({
      item,
      product,
      offer,
      storeId,
      storeName: store?.name ?? "فروشگاه",
      unitPrice: offer?.price ?? product.price,
      lineTotal: (offer?.price ?? product.price) * item.qty,
    });
  }
  return lines;
}

export function groupCartParcels(lines: CartLine[], express = false): CartParcel[] {
  const map = new Map<string, CartParcel>();
  for (const line of lines) {
    const existing = map.get(line.storeId);
    if (existing) existing.lines.push(line);
    else {
      const store = getStoreById(line.storeId);
      map.set(line.storeId, {
        storeId: line.storeId,
        storeName: line.storeName,
        logo: store?.logo ?? line.storeName[0] ?? "ف",
        logoColor: store?.logoColor ?? "#c2703f",
        lines: [line],
        subtotal: 0,
        freeShip: false,
        shippingCost: 0,
        total: 0,
      });
    }
  }
  return [...map.values()].map((parcel) => {
    const subtotal = parcel.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const freeShip = subtotal >= PLATFORM.policies.freeShippingThreshold;
    const shippingCost = express ? 250_000 : freeShip ? 0 : 120_000;
    return { ...parcel, subtotal, freeShip, shippingCost, total: subtotal + shippingCost };
  });
}
