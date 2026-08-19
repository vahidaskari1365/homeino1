import type { DecorStyle } from "@/types";
import { styles, getStyle } from "@/data/styles";

export interface StylesRepository {
  list(): Promise<DecorStyle[]>;
  bySlug(slug: string): Promise<DecorStyle | undefined>;
}

export const stylesRepository: StylesRepository = {
  list: async () => styles,
  bySlug: async (slug) => getStyle(slug),
};
