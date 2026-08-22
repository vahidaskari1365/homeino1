import type { Category } from "@/types";
import { categories as mockCategories, getCategory } from "@/data/categories";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";

export interface CategoriesRepository { list(): Promise<Category[]>; bySlug(slug: string): Promise<Category | undefined>; }
async function remote(): Promise<Category[]> {
  const rows = await getDb().select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder));
  return rows.filter(r => !r.parentId).map(r => ({
    id: r.id, slug: r.slug, name: r.name, nameEn: r.nameEn ?? r.slug, description: r.description ?? undefined,
    icon: r.icon ?? "Box", image: r.image ?? "", productCount: 0,
    subcategories: rows.filter(c => c.parentId === r.id).map(c => ({ id: c.id, slug: c.slug, name: c.name })),
  }));
}
export const categoriesRepository: CategoriesRepository = {
  list: async () => process.env.DATABASE_URL ? remote() : mockCategories,
  bySlug: async slug => process.env.DATABASE_URL ? (await remote()).find(c => c.slug === slug) : getCategory(slug),
};
