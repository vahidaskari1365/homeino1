import { Container, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { toFa } from "@/lib/utils";

export default function ProductsPage() {
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
