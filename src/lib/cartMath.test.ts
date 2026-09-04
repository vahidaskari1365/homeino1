import { describe, expect, it } from "vitest";
import { addCartItem, cartCount, cartSubtotal, lineTotal, removeCartItem, setCartQty } from "./cartMath";

describe("cartMath", () => {
  it("adds a new line and increments an existing one", () => {
    const once = addCartItem([], "p1", 2);
    expect(once).toEqual([{ productId: "p1", offerId: undefined, qty: 2 }]);
    const twice = addCartItem(once, "p1", 1);
    expect(twice[0].qty).toBe(3);
  });

  it("keeps offer lines distinct", () => {
    const items = addCartItem(addCartItem([], "p1", 1, "o1"), "p1", 1, "o2");
    expect(items).toHaveLength(2);
    expect(cartCount(items)).toBe(2);
  });

  it("removes by product and optional offer", () => {
    const items = addCartItem(addCartItem([], "p1", 1, "o1"), "p1", 2, "o2");
    expect(removeCartItem(items, "p1", "o1")).toHaveLength(1);
    expect(removeCartItem(items, "p1")).toHaveLength(0);
  });

  it("setQty updates or drops zero", () => {
    const items = addCartItem([], "p1", 2);
    expect(setCartQty(items, "p1", 5)[0].qty).toBe(5);
    expect(setCartQty(items, "p1", 0)).toEqual([]);
  });

  it("computes line and cart totals", () => {
    expect(lineTotal(1000, 3)).toBe(3000);
    expect(cartSubtotal([{ price: 1000, qty: 2 }, { price: 500, qty: 1 }])).toBe(2500);
  });
});
