// ============================================================
// HOMEINO — full catalog seed: mock data → Supabase
//   npx esbuild scripts/seed-catalog.ts --bundle --platform=node \
//     --format=esm --alias:@=./src --external:pg --external:dotenv \
//     --outfile=.seed-bundle.mjs && node .seed-bundle.mjs
// Idempotent: upserts by natural keys (slug), rebuilds child rows.
// ============================================================
import crypto from "node:crypto";
import dotenv from "dotenv";
dotenv.config();
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  collectionProducts,
  collections,
  inspirations,
  inventory,
  magazineArticles,
  productCategories,
  productImages,
  productStyles,
  productVariants,
  products,
  projects,
  styleColors,
  styleFeatures,
  styleMaterials,
  styles,
  vendors,
} from "@/db/schema";
import { products as mockProducts } from "@/data/products";
import { stores as mockStores } from "@/data/stores";
import { categories as mockCategories } from "@/data/categories";
import { styles as mockStyles } from "@/data/styles";
import { inspirations as mockInspirations } from "@/data/inspirations";
import { articles as mockArticles, projectCollections as mockCollections, projects as mockProjects } from "@/data/content";

/** Deterministic UUID from a natural key — stable across re-runs. */
const det = (key: string): string => {
  const h = crypto.createHash("md5").update(`homeino:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const TABLES = { vendors, categories, styles, products, inspirations, projects, articles: magazineArticles, collections } as const;
type TableKey = keyof typeof TABLES;
const SLUG_COL = { vendors: vendors.slug, categories: categories.slug, styles: styles.slug, products: products.slug, inspirations: inspirations.slug, projects: projects.slug, articles: magazineArticles.slug, collections: collections.slug } as const;
const ID_COL = { vendors: vendors.id, categories: categories.id, styles: styles.id, products: products.id, inspirations: inspirations.id, projects: projects.id, articles: magazineArticles.id, collections: collections.id } as const;

async function upsertBySlug(
  table: TableKey,
  slug: string,
  values: Record<string, unknown>,
  idKey: string,
): Promise<string> {
  const db = getDb();
  const t = TABLES[table] as any;
  const rows = await db.select({ id: ID_COL[table] }).from(t).where(eq(SLUG_COL[table], slug)).limit(1);
  if (rows[0]) {
    await db.update(t).set(values as never).where(eq(ID_COL[table], rows[0].id));
    return rows[0].id;
  }
  const id = det(idKey);
  await db.insert(t).values({ id, ...values } as never);
  return id;
}

async function main() {
  const db = getDb();
  const log = (...a: unknown[]) => console.log("[seed]", ...a);

  // ---------- 1) vendors (stores) ----------
  const vendorIdByStoreId = new Map<string, string>();
  for (const s of mockStores) {
    const id = await upsertBySlug("vendors", s.slug, {
      name: s.name,
      slug: s.slug,
      logo: s.logo,
      cover: s.cover,
      description: s.description,
      status: "active" as const,
      verificationStatus: s.verified ? ("verified" as const) : ("unverified" as const),
      rating: s.rating.toFixed(2),
      reviewsCount: s.reviewsCount,
      salesCount: s.salesCount,
      followersCount: s.followersCount,
      sinceYear: s.sinceYear,
      city: s.city,
      badges: s.badges,
      shippingPolicy: s.shippingPolicy,
      returnPolicy: s.returnPolicy,
      responseTime: s.responseTime,
      metadata: {
        logoColor: s.logoColor,
        trending: Boolean(s.trending),
        isNew: Boolean(s.isNew),
        categorySlugs: s.categorySlugs,
        productCount: s.productCount,
      },
    }, `vendor:${s.slug}`);
    vendorIdByStoreId.set(s.id, id);
  }
  log(`vendors: ${mockStores.length}`);

  // ---------- 2) categories (roots + subcategories) ----------
  const categoryIdBySlug = new Map<string, string>();
  let catCount = 0;
  for (const [i, c] of mockCategories.entries()) {
    const rootId = await upsertBySlug("categories", c.slug, {
      slug: c.slug,
      name: c.name,
      nameEn: c.nameEn,
      description: c.description,
      icon: c.icon,
      image: c.image,
      sortOrder: i + 1,
      depth: 0,
      path: "/",
      isActive: true,
    }, `category:${c.slug}`);
    categoryIdBySlug.set(c.slug, rootId);
    catCount++;
    for (const [j, sub] of (c.subcategories ?? []).entries()) {
      if (categoryIdBySlug.has(sub.slug)) continue;
      const subId = await upsertBySlug("categories", sub.slug, {
        slug: sub.slug,
        name: sub.name,
        parentId: rootId,
        sortOrder: j + 1,
        depth: 1,
        path: `/${rootId}/`,
        isActive: true,
      }, `category:${sub.slug}`);
      categoryIdBySlug.set(sub.slug, subId);
      catCount++;
    }
  }
  log(`categories: ${catCount}`);

  // ---------- 3) styles + editorial children ----------
  for (const st of mockStyles) {
    const styleId = await upsertBySlug("styles", st.slug, {
      slug: st.slug,
      name: st.name,
      nameEn: st.nameEn,
      tagline: st.tagline,
      shortDescription: st.shortDescription,
      description: st.description,
      image: st.image,
      imageAlt: st.imageAlt,
      furnitureCharacteristics: st.furnitureCharacteristics,
      lightingCharacteristics: st.lightingCharacteristics,
      formCharacteristics: st.formCharacteristics,
      decorCharacteristics: st.decorCharacteristics,
      visualDensity: st.visualDensity,
      suitableFor: st.suitableFor,
      suitableRooms: st.suitableRooms,
      comparisonNote: st.comparisonNote,
      isPublished: true,
    }, `style:${st.slug}`);
    await db.delete(styleFeatures).where(eq(styleFeatures.styleId, styleId));
    await db.delete(styleMaterials).where(eq(styleMaterials.styleId, styleId));
    await db.delete(styleColors).where(eq(styleColors.styleId, styleId));
    if (st.keyFeatures?.length) {
      await db.insert(styleFeatures).values(st.keyFeatures.map((f, i) => ({ styleId, feature: f, position: i + 1 })));
    }
    if (st.materials?.length) {
      await db.insert(styleMaterials).values(st.materials.map((m, i) => ({ styleId, material: m, position: i + 1 })));
    }
    if (st.colorPalette?.length) {
      await db.insert(styleColors).values(st.colorPalette.map((c, i) => ({ id: det(`style-color:${st.slug}:${c.name}`), styleId, name: c.name, hex: c.hex, position: i + 1 })));
    }
  }
  log(`styles: ${mockStyles.length}`);

  // ---------- 4) products + children ----------
  const productIdByMockId = new Map<string, string>();
  for (const p of mockProducts) {
    const vendorId = vendorIdByStoreId.get(p.storeId);
    if (!vendorId) throw new Error(`product ${p.slug}: unknown storeId ${p.storeId}`);
    const productId = await upsertBySlug("products", p.slug, {
      vendorId,
      title: p.name,
      slug: p.slug,
      description: p.description,
      shortDescription: p.description.slice(0, 380),
      price: p.price,
      compareAtPrice: p.oldPrice ?? null,
      currency: "IRT",
      brand: p.brand,
      sku: p.sku ?? null,
      color: p.colors[0]?.name ?? null,
      material: p.materials[0] ?? null,
      dimensions: { display: p.dimensions ?? null },
      status: p.inStock ? ("active" as const) : ("out_of_stock" as const),
      styleSlugs: p.styleSlugs,
      tags: p.tags,
      rating: Math.round(p.rating * 10),
      reviewsCount: p.reviewsCount,
      salesCount: p.salesCount ?? p.purchaseCount ?? 0,
      metadata: {
        aiRecommended: Boolean(p.aiRecommended),
        isNew: Boolean(p.isNew),
        trending: Boolean(p.trending),
        discount: p.discount ?? null,
        subCategorySlug: p.subCategorySlug ?? null,
        categorySlug: p.categorySlug,
        colors: p.colors,
        materials: p.materials,
        specs: p.specs,
        purchaseCount: p.purchaseCount ?? 0,
      },
    }, `product:${p.slug}`);
    productIdByMockId.set(p.id, productId);

    // rebuild children (idempotent)
    await db.delete(productImages).where(eq(productImages.productId, productId));
    await db.delete(productVariants).where(eq(productVariants.productId, productId));
    await db.delete(productCategories).where(eq(productCategories.productId, productId));
    await db.delete(productStyles).where(eq(productStyles.productId, productId));
    await db.delete(inventory).where(eq(inventory.productId, productId));

    if (p.images.length) {
      await db.insert(productImages).values(p.images.map((url, i) => ({
        id: det(`pimg:${p.slug}:${i}`),
        productId,
        url,
        alt: p.name,
        position: i,
        isPrimary: i === 0,
      })));
    }
    if (p.colors.length) {
      await db.insert(productVariants).values(p.colors.map((c, i) => ({
        id: det(`pvar:${p.slug}:${c.name}`),
        productId,
        name: c.name,
        sku: p.sku ? `${p.sku}-${i + 1}` : null,
        attributes: { hex: c.hex },
        image: p.images[0] ?? null,
        isActive: true,
      })));
    }
    const catLinks: { productId: string; categoryId: string; isPrimary: boolean }[] = [];
    const primaryCat = categoryIdBySlug.get(p.categorySlug);
    if (primaryCat) catLinks.push({ productId, categoryId: primaryCat, isPrimary: true });
    const subCat = p.subCategorySlug ? categoryIdBySlug.get(p.subCategorySlug) : undefined;
    if (subCat && subCat !== primaryCat) catLinks.push({ productId, categoryId: subCat, isPrimary: false });
    if (catLinks.length) await db.insert(productCategories).values(catLinks);
    if (p.styleSlugs.length) {
      await db.insert(productStyles).values(p.styleSlugs.map((slug) => ({ productId, styleSlug: slug })));
    }
    await db.insert(inventory).values({
      id: det(`inv:${p.slug}`),
      productId,
      quantity: Math.max(0, p.stockCount ?? (p.inStock ? 25 : 0)),
      reservedQuantity: 0,
      warehouse: "main",
    });
  }
  log(`products: ${mockProducts.length}`);

  // ---------- 5) inspirations ----------
  for (const insp of mockInspirations) {
    await upsertBySlug("inspirations", insp.id, {
      slug: insp.id,
      title: insp.title,
      image: insp.image,
      styleSlug: insp.styleSlug,
      room: insp.room,
      tags: insp.tags,
      productIds: insp.productIds.map((pid) => productIdByMockId.get(pid)).filter(Boolean),
      content: {},
      status: "published" as const,
    }, `inspiration:${insp.id}`);
  }
  log(`inspirations: ${mockInspirations.length}`);

  // ---------- 6) projects + articles + collections ----------
  for (const pr of mockProjects) {
    await upsertBySlug("projects", pr.slug, {
      slug: pr.slug,
      title: pr.title,
      cover: pr.cover,
      description: pr.description,
      content: {
        client: pr.client,
        gallery: pr.gallery,
        style: pr.style,
        room: pr.room,
        area: pr.area,
        productIds: pr.productIds.map((pid) => productIdByMockId.get(pid)).filter(Boolean),
      },
      status: "published" as const,
    }, `project:${pr.slug}`);
  }
  log(`projects: ${mockProjects.length}`);

  for (const a of mockArticles) {
    await upsertBySlug("articles", a.slug, {
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      cover: a.cover,
      body: (a.content ?? []).join("\n\n"),
      category: a.category,
      tags: [a.author, `${a.readTime} دقیقه`, a.date].filter(Boolean),
      status: "published" as const,
    }, `article:${a.slug}`);
  }
  log(`articles: ${mockArticles.length}`);

  for (const c of mockCollections) {
    const collectionId = await upsertBySlug("collections", c.slug, {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      image: c.image,
      isPublic: true,
    }, `collection:${c.slug}`);
    await db.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId));
    // collections only carry a count in mock — link trending products as a preview
    const preview = mockProducts.filter((p) => p.trending).slice(0, Math.max(1, c.count));
    if (preview.length) {
      const ids = preview.map((p) => productIdByMockId.get(p.id)).filter(Boolean) as string[];
      if (ids.length) await db.insert(collectionProducts).values(ids.map((productId) => ({ collectionId, productId })));
    }
  }
  log(`collections: ${mockCollections.length}`);

  // ---------- 7) summary from DB ----------
  for (const t of ["vendors", "categories", "styles", "products", "inspirations", "projects", "articles", "collections"] as TableKey[]) {
    const n = await db.select({ id: ID_COL[t] }).from(TABLES[t] as any).limit(500);
    log(`${t} in DB:`, n.length);
  }
  log("DONE ✅");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] FAILED:", err);
    process.exit(1);
  });
