"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Star } from "lucide-react";
import { cn, formatPrice, toFa, faGroup, fromFa } from "@/lib/utils";

/* ---------- Container ---------- */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/* ---------- Button ---------- */
type Variant = "primary" | "accent" | "ghost" | "outline" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
const variants: Record<Variant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  ghost: "btn-ghost",
  outline: "border border-clay/70 text-ink hover:bg-ivory-2 transition",
  soft: "bg-sand/60 text-ink hover:bg-sand transition",
};
const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
  icon: "h-10 w-10 grid place-items-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium select-none disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ---------- Badge ---------- */
export function Badge({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: "neutral" | "accent" | "success" | "dark" | "gold" }) {
  const tones = {
    neutral: "bg-ivory-2 text-ink-muted border-clay/50",
    accent: "bg-terracotta/12 text-terracotta-deep border-terracotta/30",
    success: "bg-sage/15 text-success border-sage/30",
    dark: "bg-ink text-cream border-ink",
    gold: "bg-gold/15 text-gold border-gold/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Chip ---------- */
export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition whitespace-nowrap",
        active ? "border-ink bg-ink text-cream" : "border-clay/60 bg-cream text-ink-muted hover:border-ink hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Rating ---------- */
export function Rating({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted">
      <Star size={size} className="fill-gold text-gold" />
      <span className="font-medium text-ink">{toFa(value.toFixed(1))}</span>
      {count != null && <span className="text-xs">({toFa(count)})</span>}
    </span>
  );
}

/* ---------- Price ---------- */
export function Price({ price, oldPrice, className }: { price: number; oldPrice?: number; className?: string }) {
  const disc = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-lg font-bold text-ink">{toFa(formatPrice(price))}</span>
        <span className="text-[11px] text-ink-muted">تومان</span>
      </div>
      {oldPrice && oldPrice > price && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted line-through">{toFa(formatPrice(oldPrice))}</span>
          {disc > 0 && <span className="text-[11px] font-bold text-terracotta-deep">{toFa(disc)}٪ تخفیف</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

/* ---------- Spinner ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-clay border-t-terracotta", className)} />
  );
}

/* ---------- Section heading ---------- */
export function SectionHeading({ eyebrow, title, desc, action }: { eyebrow?: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-deep">{eyebrow}</div>}
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl text-balance">{title}</h2>
        {desc && <p className="mt-2 text-sm text-ink-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-clay/70 bg-cream/60 px-6 py-16 text-center">
      {icon && <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-sand/60 text-ink-muted">{icon}</div>}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {desc && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Number input (auto 3-digit grouping + Persian) ---------- */
export function FaNumberInput({ value, onChange, placeholder, className, dir = "ltr" }: { value: string; onChange: (rawDigits: string) => void; placeholder?: string; className?: string; dir?: "ltr" | "rtl" }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      dir={dir}
      value={faGroup(value)}
      onChange={(e) => onChange(fromFa(e.target.value).replace(/[^\d]/g, ""))}
      placeholder={placeholder}
      className={className}
    />
  );
}

/* ---------- Avatar (logo block) ---------- */
export function LogoBlock({ char, color, size = 44 }: { char: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-display font-bold text-cream"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {char}
    </span>
  );
}
