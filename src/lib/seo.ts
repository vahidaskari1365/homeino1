// ============================================================
// JSON-LD Structured Data generators for SEO.
// Base URL comes from `@/config/site` so JSON-LD tracks the
// active deployment (preview, staging, production) automatically.
// ============================================================
import { absoluteUrl } from "@/config/site";

/** Normalize Persian date strings like `۱۴۰۳/۰۸/۱۰` to ISO `1403-08-10`. */
function toIsoDate(value: string): string {
  const latin = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  return latin.replace(/\//g, "-").trim();
}

export function productJsonLd(p: {
  name: string; slug: string; brand: string; price: number; oldPrice?: number;
  images: string[]; rating: number; reviewsCount: number; description: string; inStock: boolean;
  category: string; colors: string[];
}) {
  // Product prices in this storefront are stored in Toman. Schema.org's
  // priceCurrency is IRR (Rial), so convert truthfully (1 Toman = 10 Rial).
  const toRial = (toman: number) => Math.round(toman * 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    brand: { "@type": "Brand", name: p.brand },
    category: p.category,
    image: p.images,
    offers: {
      "@type": "Offer",
      priceCurrency: "IRR",
      price: toRial(p.price),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${p.slug}`),
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviewsCount,
    },
    color: p.colors.join(", "),
  };
}

export function storeJsonLd(s: {
  name: string; slug: string; description: string; city: string; rating: number; reviewsCount: number; cover: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name,
    description: s.description,
    image: s.cover,
    address: { "@type": "PostalAddress", addressLocality: s.city },
    aggregateRating: { "@type": "AggregateRating", ratingValue: s.rating, reviewCount: s.reviewsCount },
    url: absoluteUrl(`/stores/${s.slug}`),
  };
}

export function articleJsonLd(a: {
  title: string; excerpt: string; author: string; date: string; cover: string; slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    author: { "@type": "Person", name: a.author },
    datePublished: toIsoDate(a.date),
    image: a.cover,
    url: absoluteUrl(`/magazine/${a.slug}`),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

/** Website + SearchAction — hint search engines about our search page. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Homeino",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/search")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/** Organization — brand knowledge graph. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Homeino",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/favicon.ico"),
  };
}
