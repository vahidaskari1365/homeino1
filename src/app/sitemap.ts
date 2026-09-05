import type { MetadataRoute } from "next";
import { productsRepository } from "@/repositories/products";
import { categoriesRepository } from "@/repositories/categories";
import { storesRepository } from "@/repositories/stores";
import { stylesRepository } from "@/repositories/styles";
import { inspirationsRepository } from "@/repositories/inspirations";
import { contentRepository } from "@/repositories/content";
import { SITE_URL } from "@/config/site";

/**
 * Sitemap architecture — every public route is emitted here.
 * Private surfaces (admin, vendor, account, cart, checkout, api)
 * are disallowed in robots.ts and intentionally NOT included.
 *
 * Data is read through repositories so mock and live catalogs share
 * the same URL shape. Mock output matches the previous @/data imports.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const now = new Date();

  const [products, categories, stores, styles, inspirations, articles, projects] = await Promise.all([
    productsRepository.list(),
    categoriesRepository.list(),
    storesRepository.list(),
    stylesRepository.list(),
    inspirationsRepository.list(),
    contentRepository.articles(),
    contentRepository.projects(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/stores`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/inspiration`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/styles`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/magazine`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/second-hand`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    // /search is intentionally excluded: the route is noindex (internal
    // search results per Google guideline) — keeping it here would send
    // conflicting signals to crawlers.
    { url: `${base}/ai/design`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const storeRoutes: MetadataRoute.Sitemap = stores.map((s) => ({
    url: `${base}/stores/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const styleRoutes: MetadataRoute.Sitemap = styles.map((s) => ({
    url: `${base}/styles/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const inspirationRoutes: MetadataRoute.Sitemap = inspirations.map((i) => ({
    url: `${base}/inspiration/${i.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}/magazine/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${base}/projects/${p.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...storeRoutes,
    ...styleRoutes,
    ...inspirationRoutes,
    ...articleRoutes,
    ...projectRoutes,
  ];
}
