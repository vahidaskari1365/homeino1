"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Share2, Heart, RotateCcw, Edit3, Sparkles, ShoppingBag, Wand2, History } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, Badge, LogoBlock, EmptyState } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { useUi, useCredits } from "@/stores/useApp";
import { useCart, useWishlist } from "@/stores/useShop";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { aiService } from "@/services/ai";
import { costOf } from "@/services/ai/credits";
import type { PipelineInput } from "@/services/ai/pipeline";
import { cn, toFa, formatPrice } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";
import { downloadDataUrl } from "@/lib/downloadDataUrl";
import { useHasHydrated } from "@/lib/useHasHydrated";

function faDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

function modeLabel(scope: "targeted" | "full"): string {
  return scope === "full" ? "بازطراحی اتاق" : "ویرایش عکس";
}

export default function AIResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sessions = useDesignSessions((s) => s.sessions);
  const saveSession = useDesignSessions((s) => s.saveSession);
  const hydrated = useHasHydrated();
  const design = hydrated ? sessions.find((s) => s.id === id) : undefined;
  const { toast } = useUi();
  const router = useRouter();
  const addToCart = useCart((s) => s.add); const wl = useWishlist();
  const [busy, setBusy] = useState(false);

  const onEdit = () => {
    // REAL continue-editing: reopens the studio with this session restored
    // (was: a fake toast that claimed an editor opened).
    if (design) router.push(`/ai/design?session=${design.id}`);
    else toast("اول صبر کن طراحی بارگذاری شود", "info");
  };

  const onDownload = () => {
    if (!design) return;
    downloadDataUrl(design.afterImage, `homeino-${design.id}.png`);
    toast("دانلود آغاز شد");
  };

  const onRegenerate = async () => {
    if (!design || busy) return;
    setBusy(true);
    toast("در حال تولید نسخه جدید…");
    const pipelineInput: PipelineInput = {
      prompt: design.prompt || "بازطراحی فضا",
      style: design.style,
      room: design.roomType,
      colors: design.colors.length ? design.colors : undefined,
      scope: design.scope,
      targets: design.targets.length ? design.targets : undefined,
      referenceImage: design.beforeImage || undefined,
    };
    const opCost = design.creditsUsed || costOf(design.scope === "full" ? "generate" : "edit");
    const result = await useCredits.getState().runAiOperation("بازتولید", opCost, async () => aiService.pipeline(pipelineInput));
    setBusy(false);
    if (!result.ok) {
      if (result.reason === "insufficient") return toast("اعتبار کافی نیست", "error");
      return toast("خطا در بازتولید", "error");
    }
    const after = result.result.result.afterImage;
    const isPreview = !!result.result.result.preview || after === design.beforeImage;
    saveSession({
      title: design.title,
      prompt: design.prompt,
      roomType: design.roomType,
      style: design.style,
      colors: design.colors,
      scope: design.scope,
      targets: design.targets,
      status: isPreview ? "partial-success" : "success",
      beforeImage: design.beforeImage,
      afterImage: isPreview ? design.beforeImage : after,
      regions: result.result.result.regions ?? [],
      products: design.products,
      creditsUsed: opCost,
      preview: isPreview,
      intentSummary: design.intentSummary,
      imageEngine: result.result.imageEngine,
    });
    toast(isPreview ? "پیش‌نمایش آماده شد" : "نسخه جدید آماده شد");
  };

  if (!hydrated) {
    return <Container className="py-8"><div className="h-40 rounded-2xl bg-ivory-2" /></Container>;
  }

  if (!design) {
    return (
      <Container className="py-8">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "هومینو استودیو", href: "/ai/design" }, { label: "نتیجه طراحی" }]} />
        <div className="mt-8">
          <EmptyState icon={<History size={28} />} title="طراحی‌ای پیدا نشد" desc="هنوز سشنی برای این آدرس ذخیره نشده." action={<Link href="/ai/design"><Button>شروع طراحی</Button></Link>} />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "هومینو استودیو", href: "/ai/design" }, { label: "نتیجه طراحی" }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* image */}
        <div>
          {design.beforeImage ? (
            <BeforeAfterSlider before={design.beforeImage} after={design.afterImage} />
          ) : (
            <SmartImage src={design.afterImage} alt={design.title} className="aspect-[4/3] w-full rounded-2xl" />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={onDownload}><Download size={16} /> دانلود</Button>
            <Button variant="outline" onClick={async () => { const res = await shareContent({ title: design.title, text: "طراحی هوشمند خانه با Homeino", url: buildShareUrl(`/ai/result/${design.id}`) }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا در اشتراک‌گذاری", res.method === "failed" ? "error" : "success"); }}><Share2 size={16} /> اشتراک</Button>
            <Button variant="outline" onClick={() => { wl.toggleDesign(design.id); toast(wl.designs.includes(design.id) ? "حذف شد" : "ذخیره شد"); }}><Heart size={16} className={cn(wl.designs.includes(design.id) && "fill-current")} /> ذخیره</Button>
            <Button variant="outline" disabled={busy} onClick={onRegenerate}><RotateCcw size={16} /> بازتولید</Button>
            <Button variant="accent" onClick={onEdit}><Edit3 size={16} /> ویرایش</Button>
          </div>
        </div>

        {/* info */}
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{design.roomType}</Badge>
            {design.style && <Badge tone="accent">{design.style}</Badge>}
            <Badge tone="gold"><Sparkles size={11} /> {toFa(design.creditsUsed)} اعتبار</Badge>
          </div>
          <h1 className="mt-4 font-display text-3xl font-black text-ink">{design.title}</h1>
          <p className="mt-2 rounded-xl bg-ivory-2 p-3 text-sm italic text-ink-muted">«{design.prompt}»</p>

          <div className="mt-5 rounded-2xl border border-clay/40 p-4">
            <div className="mb-2 text-xs text-ink-muted">جزئیات</div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">حالت</span><span className="font-medium text-ink">{modeLabel(design.scope)}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">تاریخ</span><span className="font-medium text-ink">{faDate(design.createdAt)}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">وضعیت</span><span className="font-medium text-success">تکمیل شده</span></div>
          </div>

          <Link href="/ai/design"><Button className="mt-5 w-full"><Wand2 size={18} /> طراحی جدید بساز</Button></Link>
        </div>
      </div>

      {/* products in design */}
      <div className="mt-12">
        <h2 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-ink"><Sparkles size={20} className="text-gold" /> محصولات داخل این طراحی</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {design.products.map((p, i) => {
            const prod = p.productId ? getProductById(p.productId) : null;
            return prod ? (
              <Link key={i} href={`/products/${prod.slug}`} className="card-surface overflow-hidden transition hover:-translate-y-1">
                <SmartImage src={prod.images[0]} alt={prod.name} className="aspect-square w-full" />
                <div className="p-4">
                  <div className="text-xs text-ink-muted">{p.label} · {prod.brand}</div>
                  <div className="line-clamp-1 font-medium text-ink">{prod.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-black text-terracotta-deep">{toFa(formatPrice(prod.price))} ت</span>
                    <span className="text-[10px] text-ink-muted">{getStoreById(prod.storeId)?.name}</span>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); addToCart(prod.id); toast("به سبد اضافه شد"); }} className="btn-accent mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm"><ShoppingBag size={15} /> افزودن به سبد</button>
                </div>
              </Link>
            ) : (
              <div key={i} className="card-surface flex items-center gap-3 p-4">
                <LogoBlock char={p.label[0]} color="#6b6358" size={48} />
                <div><div className="text-xs text-ink-muted">{p.label}</div><div className="text-sm font-medium text-ink">به‌زودی موجود</div></div>
              </div>
            );
          })}
        </div>
      </div>
    </Container>
  );
}
