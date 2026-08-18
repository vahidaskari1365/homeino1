import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { categories } from "@/data/categories";
import { stores } from "@/data/stores";
import { styles } from "@/data/styles";
import { inspirations } from "@/data/inspirations";
import { articles } from "@/data/content";
import { projects } from "@/data/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://homeino.ir";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/stores`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/inspiration`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/styles`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/magazine`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/second-hand`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/wishlist`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
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

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...storeRoutes, ...styleRoutes, ...inspirationRoutes, ...articleRoutes, ...projectRoutes];
}
