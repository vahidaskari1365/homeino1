import type { CSSProperties } from "react";

/**
 * LogoMark — مونوگرام هومینو (خانه + قوس + H)
 * بازسازی وکتوری لوگوی برند — رنگ‌ها مستقیم از توکن‌های @theme خوانده می‌شوند
 * (var(--color-*)) تا منبع حقیقت فقط globals.css باشد.
 * نسخه روشن (زمینه‌های کرم): سقف طلایی، دیوار جوهری، قوس زمردی
 * نسخه تیره (زمینه‌های جوهری): سقف طلایی روشن، دیوار کرم، قوس طلایی
 * منبع تولید: scripts/make-logo-assets.mjs (همان هندسه)
 */
const PALETTES = {
  light: { roof: "var(--color-gold)", wall: "var(--color-ink)", arch: "var(--color-terracotta)" },
  dark: { roof: "var(--color-gold-soft)", wall: "var(--color-cream)", arch: "var(--color-gold)" },
} as const;

export function LogoMark({
  variant = "light",
  className,
  style,
}: {
  variant?: keyof typeof PALETTES;
  className?: string;
  style?: CSSProperties;
}) {
  const { roof, wall, arch } = PALETTES[variant];
  return (
    <svg
      viewBox="0 0 140 144"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none">
        {/* colors applied via style (CSS properties) — var() in SVG presentation
            attributes is not guaranteed across browsers */}
        <polyline points="16,44 76,15 136,44" style={{ stroke: roof }} strokeWidth={4.5} strokeLinejoin="miter" />
        <rect x="31.5" y="49" width="14.5" height="90" style={{ stroke: wall }} strokeWidth={3.4} />
        <rect x="46" y="86" width="32" height="10.5" style={{ fill: wall }} />
        <path d="M 83 139 L 83 50 A 17 17 0 0 1 117 50 L 117 139" style={{ stroke: arch }} strokeWidth={11} />
      </g>
    </svg>
  );
}
