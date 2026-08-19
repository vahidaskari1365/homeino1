"use client";

import Image, { type ImageProps } from "next/image";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type SmartImageProps = {
  src: string | undefined | null;
  alt: string;
  className?: string;
  /** Above-the-fold hero image? Skips lazy loading + hints priority to Next. */
  priority?: boolean;
  /** Provide realistic sizes so the CDN serves the smallest sensible variant. */
  sizes?: string;
  /** Override object-fit if you don't want the default `cover`. */
  fit?: "cover" | "contain";
  /** Advanced: pass raw next/image props through (rarely needed). */
  imageProps?: Partial<ImageProps>;
  style?: CSSProperties;
};

const DEFAULT_SIZES =
  "(min-width: 1440px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/**
 * Production-grade image wrapper:
 *   • Uses `next/image` for automatic AVIF/WebP + srcset + lazy loading.
 *   • Skeleton + graceful fallback (never a broken frame).
 *   • Accepts a `sizes` hint so mobile devices download tiny variants.
 *   • Above-the-fold hero shots can pass `priority` to opt out of lazy.
 *
 * The remote hosts allowed for optimization are declared in `next.config.ts`.
 */
export function SmartImage({
  src,
  alt,
  className,
  priority,
  sizes = DEFAULT_SIZES,
  fit = "cover",
  imageProps,
  style,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(!src);

  return (
    <span className={cn("relative block overflow-hidden bg-ivory-2", className)} style={style}>
      {!loaded && !errored && <span aria-hidden="true" className="absolute inset-0 skeleton" />}
      {errored || !src ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-sand to-sand-2 text-ink-muted"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          // Data URLs / blob URLs (e.g. AI-generated previews and user uploads)
          // can't be routed through the optimizer — serve them unmodified.
          unoptimized={src.startsWith("data:") || src.startsWith("blob:")}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "transition-all duration-700",
            fit === "cover" ? "object-cover" : "object-contain",
            loaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
          )}
          {...imageProps}
        />
      )}
    </span>
  );
}
