// Dump one real catalog product per category slug → ai-test-products.json
import { writeFileSync } from "node:fs";
import { products } from "@/data/products";

const LABELS: Record<string, string> = {
  furniture: "مبل ال", dining: "میز ناهارخوری", curtain: "پرده", carpet: "فرش",
  lighting: "آباژور ایستاده", "tv-console": "میز TV", "bookcase-shoe": "کتابخانه",
  bedding: "تخت", plants: "گیاه", art: "تابلو", accessories: "اکسسوری",
  office: "میز اداری", "second-hand": "مبلمان دست‌دوم",
};
const PICK: Record<string, string> = {
  furniture: "p1", dining: "p4", curtain: "p14", carpet: "p12", lighting: "p9",
  "tv-console": "p39", "bookcase-shoe": "p30", bedding: "p19", plants: "p6",
  art: "p8", accessories: "p26", office: "p23", "second-hand": "p2",
};

const out: Record<string, { id: string; name: string; label: string; image: string; categorySlug: string }> = {};
for (const [slug, id] of Object.entries(PICK)) {
  const p = products.find((x) => x.id === id);
  if (!p) { console.error(`MISSING ${id} for ${slug}`); continue; }
  out[slug] = { id: p.id, name: p.name, label: LABELS[slug] ?? slug, image: p.images[0], categorySlug: p.categorySlug };
}
writeFileSync("/home/z/my-project/scripts/ai-test-products.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 900));
