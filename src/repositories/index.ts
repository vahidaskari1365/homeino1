// ============================================================
// REPOSITORIES — the ONLY layer allowed to import from `@/data/*`
// (and, later, from the real backend/Supabase). UI code depends
// on these interfaces so the storage backend can be swapped
// without touching pages, components, or stores.
//
// All methods are async by design — the mock impl resolves
// synchronously today, but the signature is future-proof for
// remote fetches and streaming.
// ============================================================

export * from "./products";
export * from "./stores";
export * from "./categories";
export * from "./styles";
export * from "./inspirations";
export * from "./content";
