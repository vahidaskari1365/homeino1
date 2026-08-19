import type { Product } from "@/types";
import {
  products,
  getProduct as _getProduct,
  getProductById as _getProductById,
  productsByCategory as _productsByCategory,
  productsByStyle as _productsByStyle,
  similarProducts as _similarProducts,
  trendingProducts as _trendingProducts,
  getProductSalesCount as _getProductSalesCount,
} from "@/data/products";

export interface ProductsRepository {
  list(): Promise<Product[]>;
  bySlug(slug: string): Promise<Product | undefined>;
  byId(id: string): Promise<Product | undefined>;
  byCategory(slug: string): Promise<Product[]>;
  byStyle(slug: string): Promise<Product[]>;
  similar(productId: string, take?: number): Promise<Product[]>;
  trending(take?: number): Promise<Product[]>;
  salesCount(product: Product): Promise<number>;
}

/** Mock implementation — swap the module below to a real backend later. */
export const productsRepository: ProductsRepository = {
  list: async () => products,
  bySlug: async (slug) => _getProduct(slug),
  byId: async (id) => _getProductById(id),
  byCategory: async (slug) => _productsByCategory(slug),
  byStyle: async (slug) => _productsByStyle(slug),
  similar: async (productId, take) => _similarProducts(productId, take),
  trending: async (take = 12) => _trendingProducts.slice(0, take),
  salesCount: async (product) => _getProductSalesCount(product),
};
