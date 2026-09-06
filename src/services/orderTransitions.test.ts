import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS } from "./orderService";

/**
 * Pure-logic checks for the order state machine (DB paths are covered by the
 * staging roundtrip suite). The transition map is the security boundary:
 * anything it allows, the API allows.
 */
describe("ORDER_TRANSITIONS (order lifecycle integrity)", () => {
  it("a pending order can be confirmed, cancelled or refunded", () => {
    expect(ORDER_TRANSITIONS.pending).toEqual(
      expect.arrayContaining(["confirmed", "cancelled", "refunded"]),
    );
  });

  it("terminal states are truly terminal", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
  });

  it("delivered can only be refunded — never re-opened", () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual(["refunded"]);
  });

  it("no transition ever goes backwards to pending", () => {
    for (const [from, allowed] of Object.entries(ORDER_TRANSITIONS)) {
      if (from !== "pending") expect(allowed).not.toContain("pending");
    }
  });

  it("shipped cannot be cancelled (parcel is on the way)", () => {
    expect(ORDER_TRANSITIONS.shipped).not.toContain("cancelled");
  });
});
