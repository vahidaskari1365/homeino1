// ============================================================
// HOMEINO — PREFERENCE ENGINE (Customer Intelligence core)
//
// Turns REAL behavioural events into a CustomerProfile. It never guesses:
//   • no events                → dataState "no_data", empty preferences
//   • a few events             → dataState "not_enough_data" (low confidence)
//   • enough weighted evidence → dataState "ok"
//
// Everything is derived from analytics_events + the real catalog, so a style or
// color only appears in a profile when the customer actually interacted with
// products that carry it.
// ============================================================
import type { CustomerProfileSnapshot } from "../agents/types";
import type { EventRecord } from "../agents/store/types";
import { getStore } from "../agents/store";
import { catalogPool, type CatalogProduct } from "../agents/catalog";
import { extractShoppingIntent } from "../agents/nlu";
import { customerMemory } from "./customerMemory";

/** How much evidence each behaviour carries. Negative = explicit rejection. */
export const EVENT_WEIGHTS: Record<string, number> = {
  product_view: 1,
  product_viewed: 1,
  product_click: 1.25,
  product_clicked: 1.25,
  style_view: 1.5,
  store_view: 1,
  store_viewed: 1,
  product_search: 1.5,
  search: 1.5,
  ai_design_start: 2,
  ai_started: 2,
  ai_design_complete: 2.5,
  ai_finished: 2.5,
  ai_product_select: 2.5,
  recommendation_click: 2.5,
  wishlist_add: 3,
  product_favorited: 3,
  cart_add: 3.5,
  add_to_cart: 3.5,
  checkout_start: 4,
  checkout_started: 4,
  purchase: 5,
  order_placed: 5,
  // explicit negative signals
  wishlist_remove: -1,
  cart_remove: -1,
  recommendation_dismiss: -1.5,
};

export const TRACKED_EVENT_TYPES = Object.keys(EVENT_WEIGHTS);

const BEHAVIOURAL_EVENTS = TRACKED_EVENT_TYPES;

/** Evidence needed before we claim to know a preference. */
const MIN_EVENTS_DEFAULT = 3;
const CONFIDENCE_FULL_EVIDENCE = 25;

interface Tally {
  [key: string]: number;
}

function bump(tally: Tally, keys: string[] | string | undefined, weight: number) {
  if (!keys) return;
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (!key) continue;
    tally[key] = (tally[key] ?? 0) + weight;
  }
}

function topKeys(tally: Tally, limit: number, minWeight = 0.5): string[] {
  return Object.entries(tally)
    .filter(([, weight]) => weight >= minWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function resolveProduct(events: EventRecord[], products: CatalogProduct[]) {
  const byId = new Map(products.map((p) => [p.id.toLowerCase(), p]));
  const bySlug = new Map(products.map((p) => [p.slug.toLowerCase(), p]));
  const bySku = new Map(products.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p as CatalogProduct]));
  return (event: EventRecord): CatalogProduct | undefined => {
    if (event.entityType !== "product" || !event.entityId) return undefined;
    const key = event.entityId.toLowerCase();
    return byId.get(key) ?? bySlug.get(key) ?? bySku.get(key);
  };
}

export interface BuildProfileInput {
  userId: string | null;
  sessionId?: string | null;
  events: EventRecord[];
  products: CatalogProduct[];
  minEvents?: number;
}

/** Pure profile builder — unit-testable without any database. */
export function buildProfileFromEvents(input: BuildProfileInput): CustomerProfileSnapshot {
  const minEvents = input.minEvents ?? MIN_EVENTS_DEFAULT;
  const getProduct = resolveProduct(input.events, input.products);

  const styles: Tally = {};
  const colors: Tally = {};
  const categories: Tally = {};
  const subcategories: Tally = {};
  const materials: Tally = {};
  const rooms: Tally = {};
  const stores: Tally = {};
  const interests: Tally = {};
  const interestLabels = new Map<string, string>();
  const purchases: Tally = {};
  const prices: { price: number; weight: number }[] = [];

  let evidence = 0;
  let positiveEvents = 0;

  for (const event of input.events) {
    const weight = EVENT_WEIGHTS[event.eventType];
    if (weight === undefined) continue;
    const product = getProduct(event);

    if (weight > 0) {
      evidence += weight;
      positiveEvents += 1;
    }

    if (product) {
      bump(styles, product.styleSlugs, weight);
      bump(colors, product.colors, weight);
      bump(categories, product.categorySlug, weight);
      bump(subcategories, product.subCategorySlug, weight * 1.1);
      bump(materials, product.materials, weight * 0.8);
      bump(rooms, product.rooms, weight);
      bump(stores, product.storeId || product.storeName, weight);
      bump(interests, product.id, weight);
      interestLabels.set(product.id, product.name);
      if (weight > 0 && product.price > 0) prices.push({ price: product.price, weight });
      if (event.eventType === "purchase" || event.eventType === "order_placed") {
        bump(purchases, product.categorySlug ?? "unknown", 1);
        bump(purchases, product.styleSlugs[0] ? `style:${product.styleSlugs[0]}` : "", 1);
      }
    }

    // Search queries carry intent even without a product entity.
    if ((event.eventType === "product_search" || event.eventType === "search") && typeof event.metadata?.q === "string") {
      const intent = extractShoppingIntent(String(event.metadata.q));
      bump(styles, intent.styleSlugs, weight);
      bump(colors, intent.colors, weight);
      bump(categories, intent.categorySlug, weight);
      bump(subcategories, intent.subCategorySlug, weight);
      bump(rooms, intent.rooms, weight);
      bump(materials, intent.materials, weight);
    }

    // Style/store pages viewed directly.
    if (event.eventType === "style_view" && event.entityId) bump(styles, event.entityId, weight);
    if ((event.eventType === "store_view" || event.eventType === "store_viewed") && event.entityId) bump(stores, event.entityId, weight);
  }

  const confidence = Math.min(1, Number((evidence / CONFIDENCE_FULL_EVIDENCE).toFixed(3)));
  const dataState: CustomerProfileSnapshot["dataState"] =
    positiveEvents === 0 ? "no_data" : positiveEvents < minEvents || confidence < 0.15 ? "not_enough_data" : "ok";

  const priceRange = computePriceRange(prices);

  return {
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    preferredStyles: dataState === "no_data" ? [] : topKeys(styles, 4),
    preferredColors: dataState === "no_data" ? [] : topKeys(colors, 5),
    preferredCategories: dataState === "no_data" ? [] : topKeys({ ...categories, ...subcategories }, 5),
    preferredMaterials: dataState === "no_data" ? [] : topKeys(materials, 4),
    preferredRooms: dataState === "no_data" ? [] : topKeys(rooms, 3),
    preferredStores: dataState === "no_data" ? [] : topKeys(stores, 3),
    preferredPriceRange: priceRange,
    recentInterests:
      dataState === "no_data"
        ? []
        : Object.entries(interests)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([entityId, weight]) => ({
              entityId,
              entityType: "product",
              label: interestLabels.get(entityId),
              weight: Number(weight.toFixed(2)),
            })),
    purchasePatterns: Object.entries(purchases)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count })),
    confidence: dataState === "no_data" ? 0 : confidence,
    eventCount: positiveEvents,
    dataState,
    computedAt: new Date().toISOString(),
  };
}

function computePriceRange(samples: { price: number; weight: number }[]) {
  if (!samples.length) return {};
  const expanded = samples.flatMap((s) => new Array<number>(Math.min(5, Math.max(1, Math.round(s.weight)))).fill(s.price));
  expanded.sort((a, b) => a - b);
  const pick = (p: number) => expanded[Math.min(expanded.length - 1, Math.floor(p * (expanded.length - 1)))];
  const round = (value: number) => Math.max(0, Math.round(value / 500_000) * 500_000);
  const min = round(pick(0.15));
  const max = round(pick(0.85));
  if (!min && !max) return {};
  return { min: min || undefined, max: max > min ? max : round(max * 1.2) || undefined };
}

export interface ComputeProfileOptions {
  userId?: string | null;
  sessionId?: string | null;
  minEvents?: number;
  /** Persist the profile + memory records (default true when userId is known). */
  persist?: boolean;
  windowDays?: number;
  agentKey?: string;
  runId?: string;
}

/** Load real events, build the profile, optionally persist it. */
export async function computeCustomerProfile(options: ComputeProfileOptions = {}): Promise<CustomerProfileSnapshot> {
  const store = await getStore();
  const windowDays = options.windowDays ?? 60;
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const [events, products] = await Promise.all([
    store.listEvents({
      userId: options.userId ?? undefined,
      sessionId: options.sessionId ?? undefined,
      eventTypes: BEHAVIOURAL_EVENTS,
      since,
      limit: 1000,
    }),
    catalogPool(),
  ]);

  const profile = buildProfileFromEvents({
    userId: options.userId ?? null,
    sessionId: options.sessionId ?? null,
    events,
    products,
    minEvents: options.minEvents,
  });

  const shouldPersist = options.persist ?? Boolean(options.userId);
  if (shouldPersist && options.userId) {
    await store.upsertProfile(profile);
    await persistPreferenceMemories(profile, { agentKey: options.agentKey ?? "customer-intelligence", runId: options.runId });
  }

  return profile;
}

/** Write the derived preferences into long-term memory (Mem0-shaped records). */
async function persistPreferenceMemories(
  profile: CustomerProfileSnapshot,
  meta: { agentKey: string; runId?: string },
): Promise<void> {
  if (!profile.userId || profile.dataState === "no_data") return;
  const groups: [MemoryKeyKind, string[]][] = [
    ["style", profile.preferredStyles],
    ["color", profile.preferredColors],
    ["category", profile.preferredCategories],
    ["material", profile.preferredMaterials],
    ["room", profile.preferredRooms],
    ["store", profile.preferredStores],
  ];
  for (const [kind, values] of groups) {
    for (const value of values) {
      await customerMemory.remember(profile.userId, {
        kind: "preference",
        key: `${kind}:${value}`,
        text: `ترجیح مشتری: ${kind} = ${value}`,
        value: { kind, value, confidence: profile.confidence, dataState: profile.dataState },
        importance: Math.max(1, Math.round(profile.confidence * 5)),
        agentKey: meta.agentKey,
        runId: meta.runId,
      });
    }
  }
  if (profile.preferredPriceRange.min || profile.preferredPriceRange.max) {
    await customerMemory.remember(profile.userId, {
      kind: "preference",
      key: "price-range",
      text: `بازه قیمت مورد علاقه: ${profile.preferredPriceRange.min ?? 0} تا ${profile.preferredPriceRange.max ?? "∞"}`,
      value: { ...profile.preferredPriceRange, confidence: profile.confidence },
      importance: 3,
      agentKey: meta.agentKey,
      runId: meta.runId,
    });
  }
}

type MemoryKeyKind = "style" | "color" | "category" | "material" | "room" | "store";

/** Merge a stored profile with fresh evidence (used by the recommendation agent). */
export async function effectiveProfile(options: { userId?: string | null; sessionId?: string | null }): Promise<CustomerProfileSnapshot | null> {
  const store = await getStore();
  if (options.userId) {
    const stored = await store.getProfile(options.userId);
    if (stored && stored.dataState !== "no_data") return stored;
  }
  if (!options.userId && !options.sessionId) return null;
  const fresh = await computeCustomerProfile({ userId: options.userId ?? null, sessionId: options.sessionId ?? null, persist: Boolean(options.userId) });
  return fresh.dataState === "no_data" ? null : fresh;
}
