import { notFound } from "next/navigation";
import { productsRepository } from "@/repositories/products";
import ProductDetailClient from "./ProductDetailClient";

export const revalidate = 300;

/**
 * SERVER PDP — the money page is no longer a client-only mock read.
 * The product (and its related rail) resolve through the repository layer
 * (live DB when configured, shipped sample catalog otherwise), so a product
 * created in the vendor/admin panel immediately has a real, indexable page.
 * Interactivity (gallery/cart/offers/reviews) stays in ProductDetailClient.
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Vendor-session demo products (vp-*) live only in the browser — the client
  // shell resolves them after hydration. Anything else must exist server-side.
  if (!slug.startsWith("vp-")) {
    const product = await productsRepository.bySlug(slug);
    if (!product) notFound();
    const related = (await productsRepository.byCategory(product.categorySlug))
      .filter((p) => p.id !== product.id)
      .slice(0, 4);

    return <ProductDetailClient slug={slug} serverProduct={product} related={related} />;
  }

  return <ProductDetailClient slug={slug} serverProduct={null} related={[]} />;
}
