import { notFound } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Sparkles, Wand2 } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { InspirationCard } from "@/components/cards";
import { CommentsSection } from "@/components/inspiration/CommentsSection";
import { getAllInspirations, getInspiration } from "@/data/inspirations";
import { getProductById } from "@/data/products";
import { getStyle } from "@/data/styles";

/** Persian (Jalali) date for the credit line; null when missing/invalid. */
function faDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return null;
  }
}

export default async function InspirationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insp = getInspiration(id);
  if (!insp) notFound();

  const style = getStyle(insp.styleSlug);
  const date = faDate(insp.createdAt);
  const all = getAllInspirations();
  const similar = all.filter((i) => i.id !== insp.id && i.styleSlug === insp.styleSlug).slice(0, 8);
  const fallbackSimilar = similar.length === 0;
  const more = fallbackSimilar
    ? all.filter((i) => i.id !== insp.id).slice(0, 8)
    : similar;
  const resolvedProducts = insp.productIds
    .map((pid) => getProductById(pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const itemChips = insp.items?.length ? insp.items : insp.tags;
  const itemChipsAreItems = Boolean(insp.items?.length);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "الهام", href: "/inspiration" }, { label: insp.title }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* big pin image */}
        <div className="relative aspect-[4/3] max-h-[560px] w-full overflow-hidden rounded-3xl">
          <SmartImage src={insp.image} alt={insp.title} className="absolute inset-0 h-full w-full" priority />
        </div>

        {/* info panel */}
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{insp.room}</Badge>
            {style && <Badge tone="accent">{style.name}</Badge>}
            {insp.author?.type === "user" && <Badge tone="success">پین کاربر</Badge>}
          </div>
          <h1 className="mt-4 font-display text-3xl font-black text-ink">{insp.title}</h1>

          {/* author / source credit */}
          {(insp.author || insp.source) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              {insp.author && <span>توسط {insp.author.name}</span>}
              {insp.author && date && <span aria-hidden>·</span>}
              {date && <span>{date}</span>}
              {insp.source && (
                <>
                  {(insp.author || date) && <span aria-hidden>·</span>}
                  <span>
                    منبع:{" "}
                    {insp.source.url ? (
                      <a href={insp.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 transition hover:text-ink">
                        {insp.source.label}
                      </a>
                    ) : (
                      insp.source.label
                    )}
                  </span>
                </>
              )}
            </div>
          )}

          <p className="mt-3 leading-8 text-ink-muted">
            {insp.description ??
              `این طراحی از سبک ${style?.name ?? "دلخواه"} الهام گرفته شده. محصولات مشابه را می‌توانی از Homeino بخری یا با هومینو استودیو، مشابه آن را برای اتاق خودت بسازی.`}
          </p>

          {/* style note — gold-tinted */}
          {(insp.styleNote || style?.shortDescription) && (
            <div className="mt-5 rounded-2xl border border-gold/35 bg-gold/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-gold" />
                <h2 className="font-display text-sm font-black text-ink">سبک این فضا</h2>
              </div>
              <p className="mt-2 text-xs leading-7 text-ink-muted">{insp.styleNote ?? style?.shortDescription}</p>
            </div>
          )}

          {/* items used (or tags for legacy pins without an item list) */}
          {itemChips.length > 0 && (
            <div className="mt-5">
              <h2 className="field-label">{itemChipsAreItems ? "وسایل استفاده‌شده" : "برچسب‌ها"}</h2>
              <div className="flex flex-wrap gap-1.5">
                {itemChips.map((item) => (
                  <span key={item} className="rounded-full border border-clay/50 bg-ivory-2 px-3 py-1 text-2xs text-ink">
                    {itemChipsAreItems ? item : `#${item}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/ai/design" className="btn-accent inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
              <Wand2 size={16} /> بساز مشابهش با هومینو استودیو
            </Link>
            {style && (
              <Link href={`/styles/${style.slug}`} className="btn-ghost inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
                راهنمای سبک {style.name} ←
              </Link>
            )}
          </div>

          {/* shoppable link — honest: only real product routes */}
          {(insp.productIds.length > 0) && (
            <div className="mt-6 rounded-2xl border border-clay/50 bg-cream p-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-terracotta-deep" />
                <h2 className="font-display text-sm font-black text-ink">خرید محصولات مشابه</h2>
              </div>
              {resolvedProducts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {resolvedProducts.map((p) => (
                    <Link key={p.id} href={`/products/${p.slug}`} className="rounded-full bg-ivory-2 px-3 py-1 text-2xs text-ink transition hover:bg-sand">
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3">
                <ButtonLink href="/products" variant="soft" size="sm">مشاهده همه محصولات</ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* discussion — comments & replies under this pin */}
      <CommentsSection pinId={insp.id} />

      {/* similar pins */}
      {more.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-5 font-display text-2xl font-bold text-ink">{fallbackSimilar ? "تازه‌ترین پین‌ها" : "پین‌های مشابه"}</h2>
          <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [&>*]:mb-3 sm:[&>*]:mb-4">
            {more.map((m, i) => <InspirationCard key={m.id} insp={m} index={i} />)}
          </div>
        </div>
      )}
    </Container>
  );
}
