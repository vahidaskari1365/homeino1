import type { Style } from "@/types";
import { styles, getStyle } from "@/data/styles";

export interface StylesRepository {
  list(): Promise<Style[]>;
  bySlug(slug: string): Promise<Style | undefined>;
}

export const stylesRepository: StylesRepository = {
  list: async () => styles,
  bySlug: async (slug) => getStyle(slug),
};
