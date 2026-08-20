"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, Share2, Heart, RotateCcw, Edit3, Sparkles, ShoppingBag, Maximize2, Wand2 } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, Badge, LogoBlock } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { getAiDesign, aiDesigns } from "@/data/inspirations";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { useUi, useChat } from "@/stores/useApp";
import { useCart, useWishlist } from "@/stores/useShop";
import { cn, toFa, formatPrice } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";

export default function AIResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const design = getAiDesign(id);
  if (!design) notFound();
  const { toast } = useUi(); const { push } = useChat();
  const addToCart = useCart((s) => s.add); const wl = useWishlist();
  const [compare, setCompare] = useState(false);

  const onEdit = () => {
    push({ role: "user", content: "این طراحی رو کمی گرم‌تر کن" });
    toast("پنجره‌ی ویرایش AI باز شد");
  };

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "AI استودیو", href: "/ai/design" }, { label: "نتیجه طراحی" }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* image */}
        <div>
          {design!.beforeImage ? (
            <BeforeAfterSlider before={design!.beforeImage} after={design!.afterImage} />
          ) : (
            <SmartImage src={design!.afterImage} alt={design!.title} className="aspect-[4/3] w-full rounded-2xl" />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast("دانلود آغاز شد")}><Download size={16} /> دانلود</Button>
            <Button variant="outline" onClick={async () => { const res = await shareContent({ title: design!.title, text: "طراحی هوشمند خانه با Homeino", url: buildShareUrl(`/ai/result/${design!.id}`) }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا در اشتراک‌گذاری", res.method === "failed" ? "error" : "success"); }}><Share2 size={16} /> اشتراک</Button>
            <Button variant="outline" onClick={() => { wl.toggleDesign(design!.id); toast(wl.designs.includes(design!.id) ? "حذف شد" : "ذخیره شد"); }}><Heart size={16} className={cn(wl.designs.includes(design!.id) && "fill-current")} /> ذخیره</Button>
            <Button variant="outline" onClick={() => toast("در حال تولید نسخه جدید…")}><RotateCcw size={16} /> بازتولید</Button>
            <Button variant="accent" onClick={onEdit}><Edit3 size={16} /> ویرایش</Button>
          </div>
        </div>

        {/* info */}
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{design!.room}</Badge>
            {design!.style && <Badge tone="accent">{design!.style}</Badge>}
            <Badge tone="gold"><Sparkles size={11} /> {toFa(design!.creditsUsed)} اعتبار</Badge>
          </div>
          <h1 className="mt-4 font-display text-3xl font-black text-ink">{design!.title}</h1>
          <p className="mt-2 rounded-xl bg-ivory-2 p-3 text-sm italic text-ink-muted">«{design!.prompt}»</p>

          <div className="mt-5 rounded-2xl border border-clay/40 p-4">
            <div className="mb-2 text-xs text-ink-muted">جزئیات</div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">حالت</span><span className="font-medium text-ink">{design!.mode === "room-redesign" ? "بازطراحی اتاق" : design!.mode === "prompt-to-design" ? "طراحی از متن" : "ویرایش عکس"}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">تاریخ</span><span className="font-medium text-ink">{design!.createdAt}</span></div>
            <div className="flex justify-between py-1 text-sm"><span className="text-ink-muted">وضعیت</span><span className="font-medium text-success">تکمیل شده</span></div>
          </div>

          <Link href="/ai/design"><Button className="mt-5 w-full"><Wand2 size={18} /> طراحی جدید بساز</Button></Link>
        </div>
      </div>

      {/* products in design */}
      <div className="mt-12">
        <h2 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-ink"><Sparkles size={20} className="text-gold" /> محصولات داخل این طراحی</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {design!.products.map((p, i) => {
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
