"use client";
// ============================================================
// HOMEINO STUDIO — CLIENT COMPOSITE ENGINE
//
// Renders the "after" photo: every selected product is drawn over
// the uploaded room photo at its analyzed spot — the original piece
// is visually covered (replaced) and luminaires additionally project
// their warm glow, so the light + shape of the chosen fixture is
// visible exactly as the owner asked.
//
// Everything is honest: the result is a composite preview rendered
// in the customer's own browser (no fake "AI generated" claim) and
// labeled as such in the UI. If the canvas is tainted (cross-origin
// image), the function returns null and the UI falls back to the
// interactive overlay.
// ============================================================

export interface CompositeGlow {
  color: string;
  radiusPct: number;
  intensity: number;
}

export interface CompositePlacement {
  /** Product image URL (same-origin, supabase public, or data URL). */
  src: string;
  /** Center of the target region, normalized (0..1). */
  xNorm: number;
  yNorm: number;
  /** Product width as share of image width (0..1). */
  widthPct: number;
  /** Optional perspective squash for ground items (rug). */
  heightSquash?: number;
  glow?: CompositeGlow;
  /** Slight feathered edge so the cutout blends into the photo. */
  feather?: number;
}

export interface CompositeInput {
  roomImage: string;
  placements: CompositePlacement[];
  /** Max canvas width — larger photos are downscaled for memory safety. */
  maxWidth?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src.slice(0, 64)}`));
    img.src = src;
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Warm radial light projection (screen-blended) for luminaires. */
function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, glow: CompositeGlow): void {
  const { r, g, b } = hexToRgb(glow.color);
  const a = Math.min(0.85, Math.max(0.15, glow.intensity));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // Outer soft spread.
  const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  outer.addColorStop(0, `rgba(${r},${g},${b},${(a * 0.55).toFixed(3)})`);
  outer.addColorStop(0.55, `rgba(${r},${g},${b},${(a * 0.22).toFixed(3)})`);
  outer.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = outer;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  // Inner bright core.
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.45);
  core.addColorStop(0, `rgba(255,250,235,${(a * 0.5).toFixed(3)})`);
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Draw one product with feathered edges + grounding shadow. */
function drawProduct(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
  featherPx: number,
): void {
  // Offscreen: product + rounded feather alpha mask.
  const off = document.createElement("canvas");
  off.width = Math.max(2, Math.round(box.w));
  off.height = Math.max(2, Math.round(box.h));
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.drawImage(img, 0, 0, off.width, off.height);

  const f = Math.min(featherPx, off.width / 3, off.height / 3);
  if (f > 1) {
    octx.globalCompositeOperation = "destination-in";
    const grad = octx.createRadialGradient(
      off.width / 2, off.height / 2, Math.min(off.width, off.height) / 2 - f,
      off.width / 2, off.height / 2, Math.max(off.width, off.height) / 2,
    );
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = grad;
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalCompositeOperation = "source-over";
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = Math.max(6, box.w * 0.05);
  ctx.shadowOffsetY = Math.max(3, box.h * 0.03);
  ctx.drawImage(off, box.x, box.y, box.w, box.h);
  ctx.restore();
}

/**
 * Composite all placements onto the room photo.
 * Returns a JPEG data URL, or null when rendering is impossible
 * (canvas tainted / image failed) — callers fall back gracefully.
 */
export async function compositeRoomImage(input: CompositeInput): Promise<string | null> {
  try {
    const room = await loadImage(input.roomImage);
    const scale = Math.min(1, (input.maxWidth ?? 1600) / room.naturalWidth);
    const W = Math.round(room.naturalWidth * scale);
    const H = Math.round(room.naturalHeight * scale);
    if (W < 8 || H < 8) return null;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(room, 0, 0, W, H);

    // Load product images first — fail-soft per item.
    const loaded = await Promise.all(
      input.placements.map(async (p) => {
        try { return { p, img: await loadImage(p.src) }; } catch { return null; }
      }),
    );

    // Lights first (glow under the fixture), then products by area (large first
    // so smaller items stay visible on top).
    const items = loaded.filter((x): x is { p: CompositePlacement; img: HTMLImageElement } => x !== null);
    items.forEach(({ p }) => {
      if (!p.glow) return;
      const cx = p.xNorm * W;
      const cy = p.yNorm * H;
      drawGlow(ctx, cx, cy, Math.max(24, p.glow.radiusPct * W), p.glow);
    });

    items
      .slice()
      .sort((a, b) => b.p.widthPct - a.p.widthPct)
      .forEach(({ p, img }) => {
        const w = Math.max(8, p.widthPct * W);
        const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
        const h = w * aspect * (p.heightSquash ?? 1);
        const x = p.xNorm * W - w / 2;
        const y = p.yNorm * H - h / 2;
        drawProduct(ctx, img, { x, y, w, h }, Math.max(2, w * (p.feather ?? 0.045)));
      });

    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}
