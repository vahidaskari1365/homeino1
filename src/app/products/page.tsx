import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { getProductsForSite } from "@/lib/server/catalog";
import { jsonLdScript } from "@/lib/seo";
import { SITE_URL } from "@/config/site";
import { stores } from "@/data/stores";
import { toFa } from "@/lib/utils";

export const revalidate = 300;

/**
 * Money-page metadata: same pattern as /category/[slug] — unique title,
 * description and a self-canonical (previously this page fell back to the
 * root default title with NO canonical at all).
 */
export const metadata: Metadata = {
  title: "خرید آنلاین مبلمان و دکوراسیون خانه | هومینو",
  description: "بازارگاه هومینو: مبل، فرش، روشنایی، تابلو و دکور خانه از فروشگاه‌های معتبر ایران — مقایسه قیمت، فیلتر سبک و رنگ، ارسال به سراسر کشور.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "خرید آنلاین مبلمان و دکوراسیون خانه | هومینو",
    description: "مقایسه قیمت مبل، فرش، روشنایی و دکور خانه از فروشگاه‌های معتبر ایران.",
    type: "website",
    locale: "fa_IR",
    url: "/products",
  },
};

export default async function ProductsPage() {
  const products = await getProductsForSite();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 30).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `${SITE_URL}/products/${p.slug}`,
    })),
  };

  return (
    <Container className="py-10">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(itemList) }} />
      <PageHeader
        eyebrow="بازارگاه"
        title="همه محصولات"
        desc={`${toFa(products.length)} محصول از ${toFa(stores.length)} فروشگاه`}
      />
      <FilterableProductGrid
        products={products}
        showStoreFilter
        showMarketplaceFilters
        quickCategories
      />
    </Container>
  );
}
