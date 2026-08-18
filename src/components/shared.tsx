"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ProductCard } from "./cards";
import type { Product } from "@/types";
import { Reveal } from "./motion/Reveal";
import { Container, Skeleton } from "./ui/primitives";

/* ---------- Breadcrumb ---------- */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {it.href ? (
            <Link href={it.href} className="transition hover:text-ink">{it.label}</Link>
          ) : (
            <span className="font-medium text-ink">{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronLeft size={14} className="opacity-50" />}
        </span>
      ))}
    </nav>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ eyebrow, title, desc, children, action }: { eyebrow?: string; title: string; desc?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Reveal>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-deep">{eyebrow}</div>}
          <h1 className="font-display text-3xl font-black text-ink sm:text-4xl text-balance">{title}</h1>
          {desc && <p className="mt-2 max-w-2xl text-ink-muted">{desc}</p>}
          {children}
        </div>
        {action}
      </div>
    </Reveal>
  );
}

/* ---------- Product grid (with loading skeleton) ---------- */
export function ProductGrid({ products, loading, cols = 4 }: { products: Product[]; loading?: boolean; cols?: 3 | 4 }) {
  const colClass = cols === 3 ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  if (loading) {
    return (
      <div className={`grid gap-3 sm:gap-4 ${colClass}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-lg)] bg-ink">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`grid gap-3 sm:gap-4 ${colClass}`}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-2xl font-black text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

/* ---------- Filter group ---------- */
export function FilterGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="border-b border-clay/40 py-4">
      <h4 className="mb-3 text-sm font-bold text-ink">{title}</h4>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-muted transition hover:text-ink">
            <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} className="h-4 w-4 rounded border-clay accent-terracotta" />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export { Container };
