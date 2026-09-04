import { describe, expect, it } from "vitest";
import { normalizeCatalogRating } from "./rating";

describe("normalizeCatalogRating", () => {
  it("keeps 0–5 scores as-is and converts tenths", () => {
    expect(normalizeCatalogRating(4.5)).toBe(4.5);
    expect(normalizeCatalogRating(45)).toBe(4.5);
    expect(normalizeCatalogRating(0)).toBe(0);
    expect(normalizeCatalogRating(undefined)).toBe(0);
  });
});
