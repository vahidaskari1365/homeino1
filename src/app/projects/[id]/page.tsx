"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Button, Badge } from "@/components/ui/primitives";
import { getProject } from "@/data/content";
import { getProductById } from "@/data/products";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = getProject(id);
  if (!project) notFound();
  const addToCart = useCart((s) => s.add); const { toast } = useUi();

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "پروژه‌ها", href: "/projects" }, { label: project!.title }]} />

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {project!.gallery.map((g, i) => (
          <SmartImage key={i} src={g} alt="" className={`${i === 0 ? "aspect-[4/3] sm:col-span-2 sm:row-span-2" : "aspect-square"} w-full rounded-2xl`} />
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap gap-2"><Badge tone="accent">{project!.style}</Badge><Badge tone="dark">{project!.room}</Badge></div>
          <h1 className="mt-3 font-display text-3xl font-black text-ink">{project!.title}</h1>
          <p className="mt-3 leading-9 text-ink-muted">{project!.description}</p>
        </div>
        <aside className="card-surface h-fit p-5">
          <h3 className="mb-3 font-display font-bold text-ink">مشخصات پروژه</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-clay/30 py-2"><span className="text-ink-muted">کارفرما</span><span className="text-ink">{project!.client}</span></div>
            <div className="flex justify-between border-b border-clay/30 py-2"><span className="text-ink-muted">فضا</span><span className="text-ink">{project!.room}</span></div>
            <div className="flex justify-between border-b border-clay/30 py-2"><span className="text-ink-muted">سبک</span><span className="text-ink">{project!.style}</span></div>
            <div className="flex justify-between py-2"><span className="text-ink-muted">متراژ</span><span className="text-ink">{project!.area}</span></div>
          </div>
        </aside>
      </div>

      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">محصولات استفاده‌شده</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {project!.productIds.map((pid) => {
            const p = getProductById(pid);
            return p ? (
              <Link key={pid} href={`/products/${p.slug}`} className="card-surface overflow-hidden">
                <SmartImage src={p.images[0]} alt={p.name} className="aspect-square w-full" />
                <div className="p-3"><div className="line-clamp-1 text-sm font-medium text-ink">{p.name}</div><button onClick={(e) => { e.preventDefault(); addToCart(p.id); toast("به سبد اضافه شد"); }} className="btn-accent mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs"><ShoppingBag size={13} /> خرید</button></div>
              </Link>
            ) : null;
          })}
        </div>
        <Link href="/ai" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-terracotta-deep"><ArrowLeft size={15} /> این پروژه را با AI برای خودت بازسازی کن</Link>
      </div>
    </Container>
  );
}
