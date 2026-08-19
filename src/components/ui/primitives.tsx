"use client";

import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Star, X } from "lucide-react";
import { cn, formatPrice, toFa, faGroup, fromFa } from "@/lib/utils";

/* ---------- Layout ---------- */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("container-wide container-px", className)}>{children}</div>;
}

/* ---------- Buttons ---------- */
type Variant = "primary" | "accent" | "gold" | "ghost" | "outline" | "soft" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  gold: "btn-gold",
  ghost: "btn-ghost",
  outline: "border border-clay/70 bg-cream/50 text-ink transition hover:border-terracotta hover:bg-ivory-2",
  soft: "bg-sand/55 text-ink transition hover:bg-sand",
  danger: "border border-danger/25 bg-danger/8 text-danger transition hover:bg-danger hover:text-white",
};
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3.5 py-2 text-[13px]",
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-[15px] sm:px-7",
  icon: "icon-button",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex max-w-full select-none items-center justify-center gap-2 rounded-[var(--radius-sm)] font-bold disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function ButtonLink({ href, children, className, variant = "primary", size = "md" }: { href: string; children: ReactNode; className?: string; variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={cn("inline-flex max-w-full select-none items-center justify-center gap-2 rounded-[var(--radius-sm)] font-bold", variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

/* ---------- Inputs & dropdown ---------- */
interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, leading, id, className, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    return (
      <div className="min-w-0">
        <label htmlFor={controlId} className="field-label">{label}</label>
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-ink-muted">{leading}</span>}
          <input ref={ref} id={controlId} aria-invalid={!!error} aria-describedby={(hint || error) ? `${controlId}-help` : undefined} className={cn("field-control", leading && "pr-10", error && "border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgba(161,62,53,.1)]", className)} {...props} />
        </div>
        {(hint || error) && <p id={`${controlId}-help`} className={cn("field-hint", error && "text-danger")}>{error ?? hint}</p>}
      </div>
    );
  },
);
TextField.displayName = "TextField";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export function SelectField({ label, hint, options, id, className, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className="min-w-0">
      {label && <label htmlFor={controlId} className="field-label">{label}</label>}
      <div className="relative">
        <select id={controlId} className={cn("field-control appearance-none pl-10", className)} {...props}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: "neutral" | "accent" | "success" | "dark" | "gold" | "danger" }) {
  const tones = {
    neutral: "border-clay/45 bg-ivory-2 text-ink-muted",
    accent: "border-terracotta/25 bg-terracotta/10 text-terracotta-deep",
    success: "border-sage/30 bg-sage/12 text-success",
    dark: "border-ink bg-ink text-cream",
    gold: "border-gold/30 bg-gold/12 text-[#80601f]",
    danger: "border-danger/25 bg-danger/8 text-danger",
  };
  return <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none", tones[tone], className)}>{children}</span>;
}

/* ---------- Chips / tabs ---------- */
export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("min-h-10 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition", active ? "border-ink bg-ink text-cream shadow-sm" : "border-clay/55 bg-cream/75 text-ink-muted hover:border-terracotta hover:text-ink")}>
      {children}
    </button>
  );
}

export interface TabItem<T extends string = string> { id: T; label: string; icon?: React.ComponentType<{ size?: number; className?: string }>; count?: number }
export function Tabs<T extends string>({ items, value, onChange, ariaLabel = "تب‌ها", className }: { items: TabItem<T>[]; value: T; onChange: (value: T) => void; ariaLabel?: string; className?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("hide-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-clay/45 bg-cream/80 p-1.5 shadow-sm", className)}>
      {items.map((item) => {
        const active = value === item.id;
        const Icon = item.icon;
        return (
          <button key={item.id} role="tab" type="button" aria-selected={active} onClick={() => onChange(item.id)} className={cn("inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-4 text-sm font-bold transition sm:flex-1", active ? "bg-ink text-cream shadow-md" : "text-ink-muted hover:bg-ivory-2 hover:text-ink")}>
            {Icon && <Icon size={15} />}{item.label}{item.count != null && <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/15" : "bg-ivory-2")}>{toFa(item.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Rating / Price ---------- */
export function Rating({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted" aria-label={`امتیاز ${value} از ۵`}>
      <Star size={size} className="fill-gold text-gold" />
      <span className="font-bold text-ink">{toFa(value.toFixed(1))}</span>
      {count != null && <span className="text-xs">({toFa(count)})</span>}
    </span>
  );
}

export function Price({ price, oldPrice, className }: { price: number; oldPrice?: number; className?: string }) {
  const disc = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-lg font-black text-ink">{toFa(formatPrice(price))}</span>
        <span className="text-[11px] text-ink-muted">تومان</span>
      </div>
      {oldPrice && oldPrice > price && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-muted line-through">{toFa(formatPrice(oldPrice))}</span>{disc > 0 && <span className="text-[11px] font-bold text-terracotta-deep">{toFa(disc)}٪ تخفیف</span>}</div>}
    </div>
  );
}

/* ---------- Loading ---------- */
export function Skeleton({ className }: { className?: string }) { return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} />; }
export function Spinner({ className }: { className?: string }) { return <span role="status" aria-label="در حال بارگذاری" className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current", className)} />; }
export function LoadingState({ label = "در حال آماده‌سازی…" }: { label?: string }) {
  return <div className="card-surface flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center"><Spinner className="h-6 w-6 text-terracotta" /><p className="text-sm text-ink-muted">{label}</p></div>;
}

/* ---------- Section heading ---------- */
export function SectionHeading({ eyebrow, title, desc, action, align = "start", inverse = false }: { eyebrow?: string; title: string; desc?: string; action?: ReactNode; align?: "start" | "center"; inverse?: boolean }) {
  return (
    <div className={cn("mb-7 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", align === "center" && "items-center text-center sm:flex-col sm:items-center")}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <div className={cn("mb-2 text-xs font-bold tracking-[0.16em]", inverse ? "text-gold-soft" : "text-terracotta-deep")}>{eyebrow}</div>}
        <h2 className={cn("text-balance font-display text-2xl font-black sm:text-3xl", inverse ? "text-cream" : "text-ink")}>{title}</h2>
        {desc && <p className={cn("mt-2 text-pretty text-sm leading-7 sm:text-base", inverse ? "text-cream/65" : "text-ink-muted")}>{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------- States ---------- */
export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-clay/70 bg-cream/65 px-5 py-12 text-center shadow-[var(--shadow-soft)] sm:px-8">
      {icon && <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-sand/45 text-ink-muted">{icon}</div>}
      <h3 className="text-balance font-display text-lg font-black text-ink">{title}</h3>
      {desc && <p className="mt-2 max-w-md text-pretty text-sm text-ink-muted">{desc}</p>}
      {action && <div className="mt-5 max-w-full">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "مشکلی پیش آمد", desc, onRetry }: { title?: string; desc?: string; onRetry?: () => void }) {
  return <EmptyState icon={<AlertTriangle size={28} className="text-danger" />} title={title} desc={desc ?? "اتصال را بررسی کن و دوباره تلاش کن."} action={onRetry ? <Button variant="outline" onClick={onRetry}>تلاش دوباره</Button> : undefined} />;
}

export function ConfirmationState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return <EmptyState icon={<CheckCircle2 size={30} className="text-success" />} title={title} desc={desc} action={action} />;
}

export function StatusBanner({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children: ReactNode }) {
  const styles = { info: "border-info/20 bg-info/7 text-info", success: "border-success/20 bg-success/7 text-success", warning: "border-warning/20 bg-warning/7 text-warning", danger: "border-danger/20 bg-danger/7 text-danger" };
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-[var(--radius-md)] border p-4 text-sm leading-7", styles[tone])}>{title && <div className="mb-1 font-bold">{title}</div>}<div>{children}</div></div>;
}

/* ---------- Modal / confirmation ---------- */
export function Modal({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-panel animate-[scaleIn_.3s_var(--ease-out-expo)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-clay/35 px-5 py-4 sm:px-6">
          <div className="min-w-0"><h2 id={titleId} className="text-lg font-black text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div>
          <button type="button" onClick={onClose} className="icon-button -m-1 text-ink-muted transition hover:bg-ivory-2 hover:text-ink" aria-label="بستن"><X size={19} /></button>
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-clay/35 bg-ivory-2/45 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </section>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "تأیید", destructive }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; destructive?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} description={description} footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button variant={destructive ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>} />;
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[130] bg-ink/55 backdrop-blur-sm" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby={titleId} className="drawer-panel animate-[drawerIn_.32s_var(--ease-out-expo)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-clay/35 px-5 py-4">
          <h2 id={titleId} className="text-lg font-black text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="icon-button -m-1 text-ink-muted hover:bg-ivory-2 hover:text-ink" aria-label="بستن"><X size={19} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-clay/35 bg-ivory-2/45 p-4">{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------- Number input ---------- */
export function FaNumberInput({ value, onChange, placeholder, className, dir = "ltr" }: { value: string; onChange: (rawDigits: string) => void; placeholder?: string; className?: string; dir?: "ltr" | "rtl" }) {
  return <input type="text" inputMode="numeric" dir={dir} value={faGroup(value)} onChange={(event) => onChange(fromFa(event.target.value).replace(/[^\d]/g, ""))} placeholder={placeholder} className={className} />;
}

/* ---------- Avatar / logo ---------- */
export function LogoBlock({ char, color, size = 44 }: { char: string; color: string; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-xl font-display font-black text-cream shadow-sm" style={{ width: size, height: size, backgroundColor: color }}>{char}</span>;
}
