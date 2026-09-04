/** Download a data URL (or remote URL) as a file via a Blob. */
export function downloadDataUrl(src: string, filename: string) {
  if (typeof document === "undefined") return;
  const trigger = (href: string, revoke?: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) URL.revokeObjectURL(revoke);
  };
  if (!src.startsWith("data:")) {
    trigger(src);
    return;
  }
  const comma = src.indexOf(",");
  const header = comma >= 0 ? src.slice(0, comma) : "data:image/png;base64";
  const payload = comma >= 0 ? src.slice(comma + 1) : src;
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  trigger(url, url);
}
