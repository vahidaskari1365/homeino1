import type { InspirationImage, AiDesign, Review } from "@/types";
import {
  inspirations,
  getInspiration,
  aiDesigns,
  getAiDesign,
  sampleReviews,
} from "@/data/inspirations";

export interface InspirationsRepository {
  list(): Promise<InspirationImage[]>;
  byId(id: string): Promise<InspirationImage | undefined>;
  aiDesigns(): Promise<AiDesign[]>;
  aiDesignById(id: string): Promise<AiDesign | undefined>;
  reviews(): Promise<Review[]>;
}

export const inspirationsRepository: InspirationsRepository = {
  list: async () => inspirations,
  byId: async (id) => getInspiration(id),
  aiDesigns: async () => aiDesigns,
  aiDesignById: async (id) => getAiDesign(id),
  reviews: async () => sampleReviews,
};
