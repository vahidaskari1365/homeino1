// ============================================================
// SOCIAL SHARING — Viral loop utilities.
// Uses Web Share API with clipboard fallback.
// Future: generate shareable images, track shares.
// ============================================================

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/** Share via Web Share API (mobile) or copy to clipboard (desktop) */
export async function shareContent(data: ShareData): Promise<{ method: "native" | "clipboard" | "failed" }> {
  // Native Web Share API (iOS Safari, Android Chrome, etc.)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: data.title, text: data.text, url: data.url });
      return { method: "native" };
    } catch {
      // User cancelled — not an error
      return { method: "failed" };
    }
  }

  // Clipboard fallback (desktop)
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      const fullText = `${data.title}\n${data.text}\n${data.url}`;
      await navigator.clipboard.writeText(fullText);
      return { method: "clipboard" };
    } catch {
      return { method: "failed" };
    }
  }

  return { method: "failed" };
}

/** Build shareable URL for a design/product */
export function buildShareUrl(path: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://homeino.ir";
  return `${base}${path}`;
}

/** Share to specific platforms (fallback links) */
export const SHARE_PLATFORMS = {
  pinterest: (url: string, image: string, description: string) =>
    `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(description)}`,
  telegram: (url: string, text: string) =>
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  whatsapp: (url: string, text: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  x: (url: string, text: string) =>
    `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
};
