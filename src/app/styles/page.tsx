"use client";
import Link from "next/link";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { styles } from "@/data/styles";
import { productsByStyle } from "@/data/products";
import { toFa } from "@/lib/utils";

export default function StylesPage() {
  return (
    <Container className="py-10">
      <PageHeader eyebrow="سبک‌ها" title="سبک دکوراسیون خودت را کشف کن" desc="هر سبک، یک دنیاست. ببین کدام با سلیقه‌ات جور است." />
      <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {styles.map((s) => (
          <RevealItem key={s.slug}>
            <Link href={`/styles/${s.slug}`} className="group relative block overflow-hidden rounded-[var(--radius-lg)]">
              <SmartImage src={s.image} alt={s.name} className="aspect-[4/5] w-full transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
              <div className="absolute right-4 top-4 flex gap-1.5">
                {s.palette.slice(0, 3).map((c) => <span key={c} className="h-5 w-5 rounded-full border border-cream/40" style={{ background: c }} />)}
              </div>
              <div className="absolute bottom-0 p-5 text-cream">
                <div className="text-xs opacity-70">{toFa(productsByStyle(s.slug).length)} محصول</div>
                <h3 className="font-display text-2xl font-black">{s.name}</h3>
                <p className="text-sm text-cream/75">{s.tagline}</p>
              </div>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </Container>
  );
}
