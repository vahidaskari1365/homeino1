import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd, projectJsonLd, jsonLdScript } from "@/lib/seo";
import { getProject, projects } from "@/data/content";

/** The [id] route accepts both the slug and the raw id (id-or-slug fix). */
function resolveProject(key: string) {
  return getProject(key) ?? projects.find((p) => p.id === key);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = resolveProject(id);
  if (!project) return { title: "پروژه یافت نشد" };

  const title = `${project.title} — پروژه ${project.room} با سبک ${project.style}`;
  const description = project.description.slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/projects/${project.id}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fa_IR",
      images: [{ url: project.cover, width: 1200, height: 800, alt: project.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [project.cover] },
  };
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = resolveProject(id);
  if (!project) return children;

  const structuredData = [
    breadcrumbJsonLd([
      { name: "خانه", url: "/" },
      { name: "پروژه‌ها", url: "/projects" },
      { name: project.title, url: `/projects/${project.id}` },
    ]),
    projectJsonLd({
      title: project.title,
      id: project.id,
      description: project.description,
      cover: project.cover,
      gallery: project.gallery,
      style: project.style,
      room: project.room,
      client: project.client,
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }}
      />
      {children}
    </>
  );
}
