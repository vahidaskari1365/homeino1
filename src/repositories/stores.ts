import type { Store, Collection } from "@/types";
import { stores, getStore, getStoreById, collections } from "@/data/stores";

export interface StoresRepository {
  list(): Promise<Store[]>;
  bySlug(slug: string): Promise<Store | undefined>;
  byId(id: string): Promise<Store | undefined>;
  verified(): Promise<Store[]>;
  collections(): Promise<Collection[]>;
}

export const storesRepository: StoresRepository = {
  list: async () => stores,
  bySlug: async (slug) => getStore(slug),
  byId: async (id) => getStoreById(id),
  verified: async () => stores.filter((s) => s.verified),
  collections: async () => collections,
};
