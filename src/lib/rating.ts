/**
 * Catalog ratings may be stored as tenths (45 → 4.5) or already on a 0–5 scale.
 * One rule for every mapper so toDomain / mapSerialized cannot diverge.
 */
export function normalizeCatalogRating(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 5 ? n / 10 : n;
}
