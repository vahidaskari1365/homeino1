// ============================================================
// R2 STORAGE (SERVER-ONLY) — Cloudflare R2 (S3-compatible) via aws4fetch.
//
// Purpose: persist AI result images (and later user uploads) behind a
// stable public URL instead of shipping megabyte-sized base64 payloads
// through every response/DB row.
//
// Design (matches repo conventions):
//  - env-gated: inert until R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
//    R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE are set.
//  - fail-safe: any error → null; callers keep the base64 behavior.
//    R2 is an enhancement, never a hard dependency.
//  - honest: callers label the result storage kind from the return value.
// ============================================================
import { AwsClient } from "aws4fetch";
import { createHash, randomUUID } from "node:crypto";

const ACCOUNT = (process.env.R2_ACCOUNT_ID ?? "").trim();
const KEY = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
const SECRET = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
const BUCKET = (process.env.R2_BUCKET ?? "").trim();
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? "").trim().replace(/\/+$/, "");

/** R2 is wired (creds + bucket + public base) — uploads are attempted. */
export function isR2Configured(): boolean {
  return Boolean(ACCOUNT && KEY && SECRET && BUCKET && PUBLIC_BASE);
}

/** Partially wired (creds only) — bucket ops via REST API still possible. */
export function hasR2Credentials(): boolean {
  return Boolean(ACCOUNT && KEY && SECRET && BUCKET);
}

export interface R2Upload {
  key: string;
  url: string;
  bytes: number;
}

const CONTENT_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function extFromDataUrl(dataUrl: string): { ext: string; contentType: string } {
  if (dataUrl.startsWith("data:image/png")) return { ext: "png", contentType: "image/png" };
  if (dataUrl.startsWith("data:image/webp")) return { ext: "webp", contentType: "image/webp" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

function safeClient(): AwsClient | null {
  if (!hasR2Credentials()) return null;
  try {
    return new AwsClient({ accessKeyId: KEY, secretAccessKey: SECRET });
  } catch {
    return null;
  }
}

/**
 * Upload raw bytes to R2 and return its public URL.
 * Keys: prefix/yyyy-mm/hash.ext → stable, cache-friendly, sortable.
 */
export async function uploadToR2(
  bytes: Buffer,
  opts: { prefix?: string; contentType?: string } = {},
): Promise<R2Upload | null> {
  if (!isR2Configured() || !bytes?.length) return null;
  const client = safeClient();
  if (!client) return null;

  const contentType = opts.contentType ?? CONTENT_BY_EXT.jpg;
  const ext = Object.entries(CONTENT_BY_EXT).find(([, v]) => v === contentType)?.[0] ?? "jpg";

  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const hash = createHash("sha1").update(randomUUID() + bytes.length).digest("hex").slice(0, 20);
  const prefix = (opts.prefix ?? "ai-results").replace(/[^a-z0-9/_-]/gi, "");
  const key = `${prefix}/${ym}/${hash}.${ext}`;

  try {
    const endpoint = `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${key}`;
    const res = await client.fetch(endpoint, {
      method: "PUT",
      body: new Uint8Array(bytes),
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`R2 upload ${res.status}`);
    return { key, url: `${PUBLIC_BASE}/${key}`, bytes: bytes.length };
  } catch (err) {
    console.error("[r2] upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Persist a `data:` URL result and return its public URL.
 * Non-data URLs / failures → null (caller keeps current behavior).
 */
export async function persistDataUrl(
  dataUrl: string | undefined | null,
  opts: { prefix?: string } = {},
): Promise<R2Upload | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return null;
  try {
    const b64 = dataUrl.slice(commaIdx + 1);
    const bytes = Buffer.from(b64, "base64");
    const { contentType } = extFromDataUrl(dataUrl);
    return uploadToR2(bytes, { ...opts, contentType });
  } catch (err) {
    console.error("[r2] persistDataUrl failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Attach a public `imageUrl` to a provider result that carries `afterImage`.
 * Never throws — R2 problems must not break image responses.
 */
export async function attachImageUrl(
  result: Record<string, unknown> | undefined,
  opts: { prefix?: string } = {},
): Promise<Record<string, unknown>> {
  if (!result) return result ?? {};
  const afterImage = typeof result.afterImage === "string" ? result.afterImage : undefined;
  if (!afterImage || "imageUrl" in result) return result;
  try {
    const up = await persistDataUrl(afterImage, opts);
    return up ? { ...result, imageUrl: up.url, imageStorage: "r2" as const } : result;
  } catch {
    return result;
  }
}
