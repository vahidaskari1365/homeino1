import { Container, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { getProductsForSite } from "@/lib/server/catalog";
import { stores } from "@/data/stores";
import { toFa } from "@/lib/utils";

export default async function ProductsPage() {
  const products = await getProductsForSite();
  return (
    <Container className="py-10">
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
