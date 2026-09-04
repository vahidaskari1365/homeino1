import type { CartItem } from "@/types";

export function cartCount(items: Pick<CartItem, "qty">[]): number {
  return items.reduce((n, item) => n + item.qty, 0);
}

export function addCartItem(items: CartItem[], productId: string, qty = 1, offerId?: string): CartItem[] {
  const existing = items.find((item) => item.productId === productId && item.offerId === offerId);
  if (existing) {
    return items.map((item) =>
      item.productId === productId && item.offerId === offerId ? { ...item, qty: item.qty + qty } : item,
    );
  }
  return [...items, { productId, offerId, qty }];
}

export function removeCartItem(items: CartItem[], productId: string, offerId?: string): CartItem[] {
  return items.filter((item) => !(item.productId === productId && (offerId === undefined || item.offerId === offerId)));
}

export function setCartQty(items: CartItem[], productId: string, qty: number, offerId?: string): CartItem[] {
  return items
    .map((item) => (item.productId === productId && (offerId === undefined || item.offerId === offerId) ? { ...item, qty } : item))
    .filter((item) => item.qty > 0);
}

export function lineTotal(price: number, qty: number): number {
  return price * qty;
}

export function cartSubtotal(lines: { price: number; qty: number }[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line.price, line.qty), 0);
}
