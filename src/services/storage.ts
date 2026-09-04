/**
 * Storage abstraction for Homeino media.
 *
 * Everything that touches files (product images, vendor images, avatars,
 * AI originals/results/overlays, magazine covers) must go through a
 * StorageProvider. This keeps business logic DB-agnostic and makes a future
 * Supabase Storage migration a config change, not a rewrite.
 */

export interface StoragePutOptions {
  contentType?: string;
  key?: string;
  kind?: string;
  ownerId?: string;
}

export interface StorageProvider {
  readonly name: string;
  /** Returns the public URL for a stored key. */
  url(key: string): string;
  put(key: string, data: Buffer | Uint8Array | string, opts?: StoragePutOptions): Promise<{ key: string; url: string; sizeBytes: number }>;
  presignPut?(key: string, contentType: string): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
}

/** Local filesystem provider — the default when no external storage is configured. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private baseDir: string;
  private publicBaseUrl: string;

  constructor(
    baseDir = process.env.STORAGE_LOCAL_DIR ?? "/home/team/shared/storage",
    publicBaseUrl = process.env.STORAGE_PUBLIC_URL ?? "/storage",
  ) {
    this.baseDir = baseDir;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  url(key: string) {
    return `${this.publicBaseUrl}/${key}`;
  }

  async put(key: string, data: Buffer | Uint8Array | string, _opts?: StoragePutOptions) {
    const fs = await import("fs");
    const path = await import("path");
    const full = path.join(this.baseDir, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    return { key, url: this.url(key), sizeBytes: Buffer.byteLength(data) };
  }

  async delete(key: string) {
    const fs = await import("fs");
    const path = await import("path");
    const full = path.join(this.baseDir, key);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
}

/**
 * Supabase-ready provider. Enabled when SUPABASE_URL / SUPABASE_STORAGE_BUCKET
 * are set — keys are read ONLY from server-side env, never NEXT_PUBLIC_*.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";
  private supabaseUrl: string;
  private serviceKey: string;
  private bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL ?? "";
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "homeino";
    if (!this.supabaseUrl || !this.serviceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
    }
  }

  url(key: string) {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${key}`;
  }

  async put(key: string, data: Buffer | Uint8Array | string, opts?: StoragePutOptions) {
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    const res = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        "content-type": opts?.contentType ?? "application/octet-stream",
        "x-upsert": "true",
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Supabase storage upload failed: ${res.status} ${await res.text()}`);
    }
    return { key, url: this.url(key), sizeBytes: body.byteLength };
  }

  async delete(key: string) {
    const res = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.serviceKey}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Supabase storage delete failed: ${res.status}`);
    }
  }
}

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  cached =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseStorageProvider()
      : new LocalStorageProvider();
  return cached;
}
