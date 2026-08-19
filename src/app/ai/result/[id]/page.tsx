"use client";
// ============================================================
// AI RESULT — /ai/result/[id]
// Renders a saved design session (user history) first; falls back
// to the demo showcase data. Actions: compare · download · share ·
// wishlist · re-edit (back into the designer) · products (soon).
// ============================================================
import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, Share2, Heart, Pencil, Sparkles, ShoppingBag, Wand2, History, Coins, Layers } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, ButtonLink, Badge } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { OverlayRegionsView } from "@/components/ai/OverlayRegionsView";
import { getAiDesign } from "@/data/inspirations";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { useUi } from "@/stores/useApp";
import { useCart, useWishlist } from "@/stores/useShop";
import { useDesignSessions, getSessionById, SESSION_STATUS_META } from "@/stores/useDesignSessions";
import { downloadImage } from "@/lib/image";
import { shareContent, buildShareUrl } from "@/lib/share";
import { styleLabelOf, roomLabelOf } from "@/app/ai/page-config";
import { cn, toFa, formatPrice } from "@/lib/utils";

export default function AIResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [view, setView] = useState<"image" | "regions">("image");
  const { toast } = useUi();
  const addToCart = useCart((s) => s.add);
  const wl = useWishlist();

  // 1) real saved session → 2) demo showcase item
  const session = getSessionById(id);
  const demo = session ? null : getAiDesign(id);
  if (!session && !demo) notFound();

  // keep this page reactive to deletions happening elsewhere
  useDesignSessions((s) => s.sessions.length);

  const title = session?.title ?? demo!.title;
  const beforeImage = session?.beforeImage ?? demo!.beforeImage;
  const afterImage = session?.afterImage ?? demo!.afterImage;
  const regions = session?.regions ?? [];
  const products = session?.products ?? demo!.products;
  const statusLabel = session ? SESSION_STATUS_META[session.status].label : "تکمیل شده";
  const inWishlist = session ? wl.designs.includes(session.id) : false;

  const onDownload = async () => {
    const ok = await downloadImage(afterImage, `homeino-${id}.png`);
    toast(ok ? "دانلود آغاز شد" : "دانلود ممکن نشد", ok ? "success" : "error");
  };

  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-8">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "طراحی هوشمند", href: "/ai" }, { label: "تاریخچه", href: "/ai/history" }, { label: title }]} />

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* image */}
          <div>
            <div className="mb-2 flex justify-end gap-0.5 rounded-lg border border-clay/40 bg-cream p-0.5 sm:w-fit">
              {([["image", beforeImage ? "قبل / بعد" : "نتیجه"], ["regions", `نواحی تغییر (${toFa(regions.length)})`]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5 text-[11px] font-bold transition", view === v ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>{l}</button>
              ))}
            </div>
            {view === "regions" ? (
              <OverlayRegionsView image={afterImage} regions={regions} className="aspect-[4/3] sm:aspect-[16/10]" />
            ) : beforeImage ? (
              <BeforeAfterSlider before={beforeImage} after={afterImage} />
            ) : (
              <SmartImage src={afterImage} alt={title} className="aspect-[4/3] w-full rounded-2xl" />
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={onDownload}><Download size={15} /> دانلود</Button>
              <Button variant="outline" onClick={async () => {
                const res = await shareContent({ title, text: "طراحی هوشمند خانه با Homeino", url: buildShareUrl(`/ai/result/${id}`) });
                toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا در اشتراک‌گذاری", res.method === "failed" ? "error" : "success");
              }}><Share2 size={15} /> اشتراک</Button>
              {session && (
                <>
                  <Button variant="outline" onClick={() => { wl.toggleDesign(session.id); toast(wl.designs.includes(session.id) ? "از مجموعه حذف شد" : "به مجموعه اضافه شد"); }}>
                    <Heart size={15} className={cn(inWishlist && "fill-current text-terracotta-deep")} /> مجموعه من
                  </Button>
                  <ButtonLink href={`/ai?session=${session.id}`} variant="accent"><Pencil size={15} /> ویرایش دوباره</ButtonLink>
                </>
              )}
              {!session && <ButtonLink href="/ai" variant="accent"><Wand2 size={15} /> طراحی مشابه بساز</ButtonLink>}
            </div>
          </div>

          {/* info */}
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="dark">{session ? roomLabelOf(session.roomType) : demo!.room}</Badge>
              <Badge tone="accent">{session ? styleLabelOf(session.style) : demo!.style}</Badge>
              {session && session.scope === "full" && <Badge tone="gold">بازطراحی کامل</Badge>}
              {session?.preview && <Badge tone="gold">پیش‌نمایش</Badge>}
            </div>
            <h1 className="mt-4 font-display text-3xl font-black text-ink">{title}</h1>
            {(session?.prompt ?? demo!.prompt) && (
              <p className="mt-2 rounded-xl bg-ivory-2 p-3 text-sm italic text-ink-muted">«{session?.prompt ?? demo!.prompt}»</p>
            )}

            <div className="mt-5 rounded-2xl border border-clay/40 p-4">
              <div className="mb-2 text-xs text-ink-muted">جزئیات</div>
              <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">وضعیت</span><span className={cn("font-medium", statusLabel === "موفق" || statusLabel === "تکمیل شده" ? "text-success" : "text-gold")}>{statusLabel}</span></div>
              <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">تاریخ</span><span className="font-medium text-ink">{session ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(session.createdAt)) : demo!.createdAt}</span></div>
              <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">اعتبار مصرف‌شده</span><span className="flex items-center gap-1 font-medium text-ink"><Coins size={12} className="text-gold" /> {toFa(session?.creditsUsed ?? demo!.creditsUsed)}</span></div>
              {session && session.scope === "targeted" && (
                <div className="flex justify-between gap-3 py-1 text-sm"><span className="shrink-0 text-ink-muted">عناصر تغییرکرد</span><span className="flex items-center gap-1 text-left font-medium text-ink"><Layers size={12} /> {session.intentSummary}</span></div>
              )}
              {session?.imageEngine && <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">موتور تصویر</span><span className="font-medium text-ink" dir="ltr">{session.imageEngine}</span></div>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <ButtonLink href="/ai" variant="primary"><Wand2 size={16} /> طراحی جدید</ButtonLink>
              <ButtonLink href="/ai/history" variant="ghost"><History size={16} /> تاریخچه</ButtonLink>
            </div>
          </div>
        </div>

        {/* products in design — future-ready (capability 16) */}
        <div className="mt-12">
          <h2 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-ink"><Sparkles size={20} className="text-gold" /> محصولات داخل این طراحی</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((p, i) => {
                const prod = p.productId ? getProductById(p.productId) : null;
                return prod ? (
                  <article key={i} className="card-surface card-interactive overflow-hidden">
                    <Link href={`/products/${prod.slug}`}><SmartImage src={prod.images[0]} alt={prod.name} className="aspect-square w-full" /></Link>
                    <div className="p-4">
                      <div className="text-xs text-ink-muted">{p.label} · {prod.brand}</div>
                      <Link href={`/products/${prod.slug}`} className="line-clamp-1 font-medium text-ink hover:text-terracotta-deep">{prod.name}</Link>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-terracotta-deep">{toFa(formatPrice(prod.price))} ت</span>
                        <span className="truncate text-[10px] text-ink-muted">{getStoreById(prod.storeId)?.name}</span>
                      </div>
                      <button onClick={() => { addToCart(prod.id); toast("به سبد اضافه شد"); }} className="btn-accent mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm"><ShoppingBag size={15} /> افزودن به سبد</button>
                    </div>
                  </article>
                ) : (
                  <div key={i} className="card-surface flex flex-col justify-center gap-1 p-4">
                    <div className="text-xs text-ink-muted">{p.label}</div>
                    <div className="text-sm font-medium text-ink">به‌زودی به محصولات واقعی لینک می‌شود</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-clay/40 bg-cream p-5 text-sm leading-7 text-ink-muted">
              وقتی موتور واقعی تصویر (Orali) متصل شود، عناصر استفاده‌شده در این طراحی به‌صورت خودکار به محصولات واقعی بازارگاه Homeino لینک می‌شوند و از همین‌جا قابل خرید خواهند بود.
            </p>
          )}
        </div>
      </Container>
    </div>
  );
}
