# Repositories — the seam between UI and data source

Every UI page that needs data should ask a **repository** for it, not the
raw `@/data` files. Today all repositories return in-memory mock data
wrapped as async promises. When the backend is wired up (Supabase, custom
API, etc.) the ONLY files that change are the repository implementations —
UI code, stores, and types stay untouched.

## Rules

1. Never import from `@/data/*` outside `src/repositories/` and the
   `sitemap.ts` / seed scripts.
2. Every repository method returns `Promise<...>` — this is deliberate so
   swapping the backing store to `fetch()` requires no signature change.
3. Errors travel through `ApiResult` (see `src/lib/apiClient.ts`) or throw
   for hard-fail read paths. Callers must handle the loading / error /
   empty states explicitly.
4. Add new methods here first, then implement in a page. Keep the
   interface narrow — this is our public contract to the future backend.

## Swap procedure

To wire a real API for e.g. products:

```ts
// src/repositories/products.ts  (new impl)
import { api } from "@/lib/apiClient";
import type { Product } from "@/types";

export const productsRepository = {
  list: () => api.get<Product[]>("/api/products"),
  bySlug: (slug: string) => api.get<Product>(`/api/products/${slug}`),
  // ...
};
```

No UI changes required — the store/component keeps calling
`productsRepository.list()`.
