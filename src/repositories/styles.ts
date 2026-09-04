import type { Style, StyleSlug } from "@/types";
import { styles as mockStyles, getStyle } from "@/data/styles";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { styleColors, styleFeatures, styleMaterials, styles } from "@/db/schema";
import { withDbFallback } from "./_fallback";

export interface StylesRepository { list(): Promise<Style[]>; bySlug(slug: string): Promise<Style | undefined>; }

async function listRemote(): Promise<Style[]> {
  const db = getDb();
  const [rows, colors, materials, features] = await Promise.all([
    db.select().from(styles).where(eq(styles.isPublished, true)).orderBy(asc(styles.name)),
    db.select().from(styleColors).orderBy(asc(styleColors.position)),
    db.select().from(styleMaterials).orderBy(asc(styleMaterials.position)),
    db.select().from(styleFeatures).orderBy(asc(styleFeatures.position)),
  ]);
  return rows.map(s => ({
    id: s.id, slug: s.slug as StyleSlug, name: s.name, nameEn: s.nameEn ?? s.slug,
    tagline: s.tagline ?? "", shortDescription: s.shortDescription ?? "", description: s.description ?? "",
    image: s.image ?? "", imageAlt: s.imageAlt ?? s.name,
    colorPalette: colors.filter(c => c.styleId === s.id).map(c => ({ name: c.name, hex: c.hex })),
    materials: materials.filter(m => m.styleId === s.id).map(m => m.material),
    keyFeatures: features.filter(f => f.styleId === s.id).map(f => f.feature),
    furnitureCharacteristics: s.furnitureCharacteristics ?? "", lightingCharacteristics: s.lightingCharacteristics ?? "",
    formCharacteristics: s.formCharacteristics ?? "", decorCharacteristics: s.decorCharacteristics ?? "",
    visualDensity: s.visualDensity ?? "", suitableFor: s.suitableFor ?? "", suitableRooms: s.suitableRooms ?? [],
    comparisonNote: s.comparisonNote ?? undefined,
  }));
}

export const stylesRepository: StylesRepository = {
  list: async () => withDbFallback(mockStyles, listRemote),
  bySlug: async slug => {
    const all = await withDbFallback(mockStyles, listRemote);
    return all.find(s => s.slug === slug) ?? getStyle(slug);
  },
};
