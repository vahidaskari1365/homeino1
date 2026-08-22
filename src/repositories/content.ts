import {
  articles,
  getArticle,
  projects,
  getProject,
  projectCollections,
  type Article,
  type Project,
} from "@/data/content";
import type { Collection } from "@/types";

export interface ContentRepository {
  articles(): Promise<Article[]>;
  article(slug: string): Promise<Article | undefined>;
  projects(): Promise<Project[]>;
  project(idOrSlug: string): Promise<Project | undefined>;
  projectCollections(): Promise<Collection[]>;
}

export const contentRepository: ContentRepository = {
  articles: async () => articles,
  article: async (slug) => getArticle(slug),
  projects: async () => projects,
  project: async (key) => getProject(key) ?? projects.find((p) => p.id === key),
  projectCollections: async () => projectCollections,
};
