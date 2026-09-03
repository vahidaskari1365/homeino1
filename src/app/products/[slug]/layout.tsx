import type { Metadata } from "next";
import type { ReactNode } from "react";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { getCategory } from "@/data/categories";
import { getProduct } from "@/data/products";
import { getStoreById } from "@/data/stores";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "محصول یافت نشد" };

  const store = getStoreById(product.storeId);
  const title = `${product.name} — ${product.brand}`;
  const description = product.description.slice(0, 155);

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fa_IR",
      images: product.images.map((img) => ({ url: img, width: 1200, height: 800, alt: product.name })),
    },
    twitter: { card: "summary_large_image", title, description, images: [product.images[0]] },
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return children;

  const category = getCategory(product.categorySlug);
  const structuredData = [
    breadcrumbJsonLd([
      { name: "خانه", url: "/" },
      { name: "محصولات", url: "/products" },
      { name: product.name, url: `/products/${product.slug}` },
    ]),
    productJsonLd({
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      price: product.price,
      oldPrice: product.oldPrice,
      images: product.images,
      rating: product.rating,
      reviewsCount: product.reviewsCount,
      description: product.description,
      inStock: product.inStock,
      category: category?.name ?? product.categorySlug,
      colors: product.colors.map((c) => c.name),
    }),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
