"use client";
import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Image with graceful skeleton + fallback. Lazy by default. */
export function SmartImage({ src, alt, className, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <span className={cn("relative block overflow-hidden bg-ivory-2", className)}>
      {!loaded && !errored && <span className="absolute inset-0 skeleton" />}
      {errored ? (
        <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-sand to-sand-2 text-ink-muted">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn("h-full w-full transition-all duration-700", loaded ? "opacity-100 scale-100" : "opacity-0 scale-105")}
          {...props}
        />
      )}
    </span>
  );
}
