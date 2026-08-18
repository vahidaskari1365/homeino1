"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { SmartImage } from "../ui/SmartImage";
import { collections } from "@/data/stores";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* visual */}
      <div className="relative hidden overflow-hidden lg:block">
        <SmartImage src={collections[0].image} alt="" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/30" />
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-cream">
          <Link href="/" className="mb-auto flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream text-ink"><span className="font-display text-lg font-black">H</span></span>
            <span className="font-display text-xl font-black">Home<span className="text-terracotta-soft">ino</span></span>
          </Link>
          <h2 className="font-display text-4xl font-black leading-tight">خانه‌ای که دوست داری، اینجا شکل می‌گیرد.</h2>
          <p className="mt-2 max-w-md text-cream/70">به بزرگ‌ترین پلتفرم خانه و دکوراسیون بپیوند. الهام، محصول و طراحی با هوش مصنوعی.</p>
        </div>
      </div>
      {/* form */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream"><span className="font-display text-lg font-black">H</span></span>
            <span className="font-display text-xl font-black text-ink">Home<span className="text-terracotta-deep">ino</span></span>
          </Link>
          <h1 className="font-display text-3xl font-black text-ink">{title}</h1>
          <p className="mt-1.5 text-ink-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
