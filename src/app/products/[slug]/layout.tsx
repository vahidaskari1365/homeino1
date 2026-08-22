import type { Metadata } from "next";
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

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
