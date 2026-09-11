import type { CSSProperties } from "react";

/**
 * LogoMark — مونوگرام هومینو (خانه + قوس + H)
 * بازسازی وکتوری لوگوی برند با پالت سایت:
 * نسخه روشن (زمینه‌های کرم): سقف طلایی، دیوار جوهری، قوس زمردی
 * نسخه تیره (زمینه‌های جوهری): سقف طلایی روشن، دیوار کرم، قوس طلایی
 * منبع تولید: scripts/make-logo-assets.mjs (همان هندسه)
 */
const PALETTES = {
  light: { roof: "#BE9A4F", wall: "#10201A", arch: "#1E5D44" },
  dark: { roof: "#D9BD7E", wall: "#F5EEE0", arch: "#BE9A4F" },
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
        <polyline points="16,44 76,15 136,44" stroke={roof} strokeWidth={4.5} strokeLinejoin="miter" />
        <rect x="31.5" y="49" width="14.5" height="90" stroke={wall} strokeWidth={3.4} />
        <rect x="46" y="86" width="32" height="10.5" fill={wall} />
        <path d="M 83 139 L 83 50 A 17 17 0 0 1 117 50 L 117 139" stroke={arch} strokeWidth={11} />
      </g>
    </svg>
  );
}
