"use client";
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import Link from "next/link";
import { AlertTriangle, Star, X } from "lucide-react";
import { cn, formatPrice, toFa, faGroup, fromFa } from "@/lib/utils";

/* ---------- Container ---------- */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/* ---------- Button ---------- */
type Variant = "primary" | "accent" | "ghost" | "outline" | "soft" | "danger" | "gold";
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
  gold: "bg-gold text-ink hover:opacity-90 transition",
  danger: "border border-danger/25 bg-danger/8 text-danger transition hover:bg-danger hover:text-white",
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
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-medium", tones[tone], className)}>
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
        <span className="text-2xs text-ink-muted">تومان</span>
      </div>
      {oldPrice && oldPrice > price && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted line-through">{toFa(formatPrice(oldPrice))}</span>
          {disc > 0 && <span className="text-2xs font-bold text-terracotta-deep">{toFa(disc)}٪ تخفیف</span>}
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
export function SectionHeading({ eyebrow, title, desc, action, inverse = false }: { eyebrow?: string; title: string; desc?: string; action?: ReactNode; inverse?: boolean }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-xl">
        {eyebrow && <div className={cn("mb-2 text-xs font-semibold uppercase tracking-[0.2em]", inverse ? "text-gold-soft" : "text-terracotta-deep")}>{eyebrow}</div>}
        <h2 className={cn("font-display text-2xl font-bold sm:text-3xl text-balance", inverse ? "text-cream" : "text-ink")}>{title}</h2>
        {desc && <p className={cn("mt-2 text-sm", inverse ? "text-cream/65" : "text-ink-muted")}>{desc}</p>}
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


/* Compatibility exports for routes added after the restored visual baseline. */
export function ButtonLink({ href, children, className, variant = "primary", size = "md" }: { href: string; children: ReactNode; className?: string; variant?: Variant; size?: Size }) {
  return <Link href={href} className={cn("inline-flex items-center justify-center gap-2 font-medium select-none", variants[variant], sizes[size], className)}>{children}</Link>;
}

export function ErrorState({ title = "مشکلی پیش آمد", desc, onRetry }: { title?: string; desc?: string; onRetry?: () => void }) {
  return <EmptyState icon={<AlertTriangle size={28} className="text-danger" />} title={title} desc={desc ?? "اتصال را بررسی کن و دوباره تلاش کن."} action={onRetry ? <Button variant="outline" onClick={onRetry}>تلاش دوباره</Button> : undefined} />;
}

export function Modal({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(open, panelRef);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-panel" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4 border-b border-clay/35 px-5 py-4"><div><h2 id={titleId} className="text-lg font-black text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div><button type="button" onClick={onClose} className="icon-button" aria-label="بستن"><X size={19} /></button></div>{children && <div className="px-5 py-5">{children}</div>}{footer && <div className="flex gap-2 border-t border-clay/35 px-5 py-4">{footer}</div>}</section></div>;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "تأیید", destructive }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; destructive?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} description={description} footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button variant={destructive ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>} />;
}
