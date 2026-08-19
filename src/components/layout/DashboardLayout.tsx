"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "../ui/primitives";

export interface NavItem { label: string; href: string; icon: React.ComponentType<{ size?: number }> }

export function DashboardLayout({ items, title, badge, children }: { items: NavItem[]; title: string; badge?: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-5 lg:hidden">
        <div className="mb-3 flex items-center gap-2 px-1">
          <h1 className="text-lg font-black text-ink">{title}</h1>
          {badge && <span className="rounded-full bg-terracotta/10 px-2 py-1 text-[10px] font-bold text-terracotta-deep">{badge}</span>}
        </div>
        <nav aria-label={`ناوبری ${title}`} className="hide-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition", isActive(item.href) ? "border-ink bg-ink text-cream shadow-sm" : "border-clay/45 bg-cream/75 text-ink-muted hover:border-terracotta hover:text-ink")}>
              <item.icon size={15} /> {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="card-surface p-3">
            <div className="px-3 py-3">
              <div className="flex items-center gap-2"><h2 className="font-display font-black text-ink">{title}</h2>{badge && <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-bold text-terracotta-deep">{badge}</span>}</div>
            </div>
            <nav aria-label={`ناوبری ${title}`} className="mt-1 space-y-0.5">
              {items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={cn("flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition", isActive(item.href) ? "bg-ink text-cream shadow-sm" : "text-ink-muted hover:bg-ivory-2 hover:text-ink")}>
                  <item.icon size={17} /> {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
