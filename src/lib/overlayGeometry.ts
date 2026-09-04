"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// PIXEL-ACCURATE OVERLAY GEOMETRY
//
// AI coordinates are in IMAGE SPACE (0-1 relative to the full
// original image). When the image renders with object-fit:cover,
// part of the image is cropped. We must compute the visible rect
// and transform image-space coords → visible container pixels.
//
// Formula:
//   1. Compute cover scale = max(cw/iw, ch/ih)
//   2. Rendered image size = iw*scale × ih*scale
//   3. Offset (cropping) = (rendered - container) / 2
//   4. pixel = norm * rendered - offset
// ============================================================

export function clamp01(v: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export interface RenderedSize { width: number; height: number }

export interface CoverRect {
  /** Visible image width in container px */
  visibleWidth: number;
  /** Visible image height in container px */
  visibleHeight: number;
  /** X offset of image origin within container (negative = cropped left) */
  offsetX: number;
  /** Y offset of image origin within container (negative = cropped top) */
  offsetY: number;
  /** Scale factor applied to the image */
  scale: number;
}

export function computeCoverRect(container: RenderedSize, natural: RenderedSize): CoverRect {
  const cw = container.width;
  const ch = container.height;
  const iw = natural.width;
  const ih = natural.height;
  const scale = Math.max(cw / iw, ch / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  return {
    visibleWidth: rw,
    visibleHeight: rh,
    offsetX: (cw - rw) / 2,
    offsetY: (ch - rh) / 2,
    scale,
  };
}

export function imageToPixel(coverRect: CoverRect, xNorm: number, yNorm: number): { left: number; top: number } {
  return {
    left: clamp01(xNorm) * coverRect.visibleWidth + coverRect.offsetX,
    top: clamp01(yNorm) * coverRect.visibleHeight + coverRect.offsetY,
  };
}

export function pixelToImage(coverRect: CoverRect, left: number, top: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: clamp01((left - coverRect.offsetX) / coverRect.visibleWidth),
    yNorm: clamp01((top - coverRect.offsetY) / coverRect.visibleHeight),
  };
}

export interface OverlayGeometry {
  containerRef: React.RefObject<HTMLDivElement>;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  aspectRatio: number | null;
  ready: boolean;
  coverRect: CoverRect | null;
  /** Transform a normalized (0-1) image-space coordinate into container pixels */
  toPixel: (xNorm: number, yNorm: number) => { left: number; top: number } | null;
  /** Inverse: transform container pixels → normalized image-space coordinate */
  fromPixel: (left: number, top: number) => { xNorm: number; yNorm: number } | null;
}

export function useOverlayGeometry(): OverlayGeometry {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<RenderedSize | null>(null);
  const [naturalSize, setNaturalSize] = useState<RenderedSize | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setNaturalSize({ width: naturalWidth, height: naturalHeight });
  }, []);

  const aspectRatio = naturalSize ? naturalSize.width / naturalSize.height : null;
  const ready = containerSize !== null && naturalSize !== null;

  // ---- Compute the cover rectangle (visible area of the image) ----
  const coverRect: CoverRect | null =
    containerSize && naturalSize ? computeCoverRect(containerSize, naturalSize) : null;

  // ---- Forward: image-space (0-1) → container pixel ----
  const toPixel = useCallback(
    (xNorm: number, yNorm: number): { left: number; top: number } | null => {
      if (!coverRect) return null;
      return imageToPixel(coverRect, xNorm, yNorm);
    },
    [coverRect]
  );

  // ---- Inverse: container pixel → image-space (0-1) ----
  const fromPixel = useCallback(
    (left: number, top: number): { xNorm: number; yNorm: number } | null => {
      if (!coverRect) return null;
      return pixelToImage(coverRect, left, top);
    },
    [coverRect]
  );

  return { containerRef: containerRef as React.RefObject<HTMLDivElement>, onImageLoad, aspectRatio, ready, coverRect, toPixel, fromPixel };
}
