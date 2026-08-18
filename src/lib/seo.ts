// ============================================================
// JSON-LD Structured Data generators for SEO.
// ============================================================

export function productJsonLd(p: {
  name: string; slug: string; brand: string; price: number; oldPrice?: number;
  images: string[]; rating: number; reviewsCount: number; description: string; inStock: boolean;
  category: string; colors: string[];
}) {
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
      price: p.price,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://homeino.ir/products/${p.slug}`,
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
    url: `https://homeino.ir/stores/${s.slug}`,
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
    datePublished: a.date,
    image: a.cover,
    url: `https://homeino.ir/magazine/${a.slug}`,
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
      item: `https://homeino.ir${item.url}`,
    })),
  };
}
