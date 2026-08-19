"use client";

import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import type { ReactNode } from "react";
import { ProductCard } from "./cards";
import type { Product } from "@/types";
import { Reveal } from "./motion/Reveal";
import { Container, Skeleton } from "./ui/primitives";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="max-w-full">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-ink-muted sm:text-sm">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {item.href ? <Link href={item.href} className="inline-flex items-center gap-1 transition hover:text-ink">{index === 0 && <Home size={13} className="hidden sm:block" />}{item.label}</Link> : <span aria-current="page" className="line-clamp-1 max-w-[60vw] font-bold text-ink sm:max-w-md">{item.label}</span>}
            {index < items.length - 1 && <ChevronLeft size={13} className="shrink-0 opacity-45" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ eyebrow, title, desc, children, action }: { eyebrow?: string; title: string; desc?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Reveal>
      <div className="mb-7 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <div className="mb-2 text-xs font-bold tracking-[0.16em] text-terracotta-deep">{eyebrow}</div>}
          <h1 className="text-balance font-display text-3xl font-black text-ink sm:text-4xl">{title}</h1>
          {desc && <p className="mt-2 max-w-2xl text-pretty text-sm leading-7 text-ink-muted sm:text-base">{desc}</p>}
          {children}
        </div>
        {action && <div className="max-w-full shrink-0">{action}</div>}
      </div>
    </Reveal>
  );
}

export function ProductGrid({ products, loading, cols = 4 }: { products: Product[]; loading?: boolean; cols?: 3 | 4 }) {
  const colClass = cols === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  if (loading) {
    return (
      <div aria-label="در حال بارگذاری محصولات" className={`grid gap-3 sm:gap-4 ${colClass}`}>
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="card-surface overflow-hidden"><Skeleton className="aspect-[4/5] w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-10 w-full" /></div></div>)}
      </div>
    );
  }
  return <div className={`grid min-w-0 gap-3 sm:gap-4 ${colClass}`}>{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export function Stat({ value, label }: { value: string; label: string }) {
  return <div className="min-w-0 text-center"><div className="font-display text-2xl font-black text-ink">{value}</div><div className="mt-0.5 text-xs text-ink-muted">{label}</div></div>;
}

export function FilterGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <fieldset className="border-b border-clay/35 py-4">
      <legend className="mb-3 text-sm font-black text-ink">{title}</legend>
      <div className="space-y-1">
        {options.map((option) => (
          <label key={option} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-ink-muted transition hover:bg-ivory-2/60 hover:text-ink">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} className="h-4 w-4 shrink-0 rounded border-clay accent-terracotta" />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { Container };
