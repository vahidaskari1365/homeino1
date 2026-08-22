// ============================================================
// IMAGE UTILITIES — client-side helpers for the AI Designer.
// ============================================================

/**
 * Downscale + re-encode a data-URL image so persisted design
 * history stays small (localStorage-friendly).
 */
export function compressImage(dataUrl: string, maxDim = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Download an image (data-URL or remote URL). Returns false on failure
 * so callers can surface an honest error.
 */
export async function downloadImage(src: string, filename: string): Promise<boolean> {
  try {
    if (src.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = src;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }
    const res = await fetch(src);
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
