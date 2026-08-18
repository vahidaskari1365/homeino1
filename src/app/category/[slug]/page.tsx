"use client";
import { use, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Breadcrumb, PageHeader, ProductGrid } from "@/components/shared";
import { Chip } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { getCategory, categories } from "@/data/categories";
import { productsByCategory } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { toFa } from "@/lib/utils";
import { InspirationCard } from "@/components/cards";

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const category = getCategory(slug);
  if (!category) notFound();

  const [sub, setSub] = useState<string | null>(null);
  const all = useMemo(() => productsByCategory(slug), [slug]);
  const list = sub ? all.filter((p) => p.subCategorySlug === sub) : all;
  const relatedIns = inspirations.filter((i) => i.tags.some((t) => category!.name.includes(t) || category!.nameEn.toLowerCase().includes(t))).slice(0, 3);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "دسته‌بندی‌ها", href: "/products" }, { label: category!.name }]} />

      {/* banner */}
      <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
        <SmartImage src={category!.image} alt={category!.name} className="h-48 w-full sm:h-64" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/85 to-ink/30" />
        <div className="absolute inset-0 flex flex-col justify-center p-8 text-cream">
          <h1 className="font-display text-3xl font-black sm:text-4xl">{category!.name}</h1>
          <p className="mt-2 max-w-md text-cream/75">{category!.description}</p>
          <div className="mt-3 text-sm text-cream/60">{toFa(category!.productCount)} محصول · {toFa(category!.subcategories.length)} زیردسته</div>
        </div>
      </div>

      {/* subcategory chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Chip active={!sub} onClick={() => setSub(null)}>همه</Chip>
        {category!.subcategories.map((sc) => (
          <Chip key={sc.id} active={sub === sc.slug} onClick={() => setSub(sc.slug)}>{sc.name}</Chip>
        ))}
      </div>

      {/* other categories quick links */}
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.filter((c) => c.slug !== slug).slice(0, 6).map((c) => (
          <Link key={c.slug} href={`/category/${c.slug}`} className="rounded-full border border-clay/50 px-3 py-1 text-xs text-ink-muted transition hover:border-ink hover:text-ink">{c.name}</Link>
        ))}
      </div>

      <div className="mt-8">
        <ProductGrid products={list} />
      </div>

      {/* related inspiration */}
      {relatedIns.length > 0 && (
        <div className="mt-14">
          <PageHeader title="الهام از این دسته" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {relatedIns.map((insp) => <InspirationCard key={insp.id} insp={insp} />)}
          </div>
        </div>
      )}
    </Container>
  );
}
