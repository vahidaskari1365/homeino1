"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "../ui/primitives";

export interface NavItem { label: string; href: string; icon: React.ComponentType<{ size?: number }> }

export function DashboardLayout({ items, title, badge, children }: { items: NavItem[]; title: string; badge?: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-3">
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-ink">{title}</h2>
                {badge && <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-2xs font-bold text-terracotta-deep">{badge}</span>}
              </div>
            </div>
            <nav className="mt-1 space-y-0.5">
              {items.map((it) => {
                const active = pathname === it.href;
                return (
                  <Link key={it.href} href={it.href} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition", active ? "bg-ink text-cream" : "text-ink-muted hover:bg-ivory-2 hover:text-ink")}>
                    <it.icon size={17} /> {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        {/* content */}
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
