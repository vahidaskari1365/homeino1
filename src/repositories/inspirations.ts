import type { InspirationImage, AiDesign, Review, StyleSlug } from "@/types";
import { inspirations as mockInspirations, getInspiration, aiDesigns, getAiDesign, sampleReviews } from "@/data/inspirations";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { inspirationImages, inspirationProducts, inspirations } from "@/db/schema";

export interface InspirationsRepository {
  list(): Promise<InspirationImage[]>; byId(id: string): Promise<InspirationImage | undefined>;
  aiDesigns(): Promise<AiDesign[]>; aiDesignById(id: string): Promise<AiDesign | undefined>; reviews(): Promise<Review[]>;
}
async function remote(): Promise<InspirationImage[]> {
  const db = getDb();
  const [rows, images, links] = await Promise.all([
    db.select().from(inspirations).where(eq(inspirations.status, "published")),
    db.select().from(inspirationImages).orderBy(asc(inspirationImages.position)),
    db.select().from(inspirationProducts).orderBy(asc(inspirationProducts.position)),
  ]);
  return rows.map(i => ({ id: i.id, title: i.title, image: images.find(x => x.inspirationId === i.id)?.url ?? i.image ?? "",
    styleSlug: (i.styleSlug ?? "modern") as StyleSlug, room: i.room ?? "", tags: i.tags ?? [],
    productIds: links.filter(x => x.inspirationId === i.id).map(x => x.productId),
  }));
}
export const inspirationsRepository: InspirationsRepository = {
  list: async () => process.env.DATABASE_URL ? remote() : mockInspirations,
  byId: async id => process.env.DATABASE_URL ? (await remote()).find(i => i.id === id) : getInspiration(id),
  aiDesigns: async () => aiDesigns,
  aiDesignById: async id => getAiDesign(id),
  reviews: async () => sampleReviews,
};
