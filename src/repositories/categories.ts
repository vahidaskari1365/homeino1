import type { Category } from "@/types";
import { categories, getCategory } from "@/data/categories";

export interface CategoriesRepository {
  list(): Promise<Category[]>;
  bySlug(slug: string): Promise<Category | undefined>;
}

export const categoriesRepository: CategoriesRepository = {
  list: async () => categories,
  bySlug: async (slug) => getCategory(slug),
};
