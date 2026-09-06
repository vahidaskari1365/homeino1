/**
 * Inspiration comments — the discussion thread under each pin.
 *
 * Two storage backends, mirroring the repo's storage philosophy:
 *  - Supabase table `inspiration_comments` when Supabase env is configured
 *    (production path, provisioned by 202609060003_inspiration_comments.sql)
 *  - A local JSON file otherwise (demo / self-hosted node) — real persistence,
 *    visible to every visitor of the instance; the file lives under `.data/`
 *    which is gitignored.
 *
 * Threading is ONE level deep: comments + replies. A reply to a reply is
 * attached to the same top-level parent, keeping the UI readable.
 */

import fs from "node:fs";
import path from "node:path";

export interface InspirationComment {
  id: string;
  pinId: string;
  parentId: string | null;
  authorName: string;
  authorType: "user" | "guest";
  body: string;
  createdAt: string; // ISO timestamp
}

export interface CommentThread {
  comment: InspirationComment;
  replies: InspirationComment[];
}

export const COMMENT_BODY_MIN = 2;
export const COMMENT_BODY_MAX = 1000;
export const COMMENT_NAME_MIN = 2;
export const COMMENT_NAME_MAX = 40;

/* ------------------------------------------------------------------ */
/* Backend detection                                                    */
/* ------------------------------------------------------------------ */

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
}

function supabaseForWrites() {
  // Lazy import: the local file-store path must not load the Supabase SDK at
  // all (keeps unit tests hermetic and startup light). Service role bypasses
  // RLS so guest comments posted through the API work; otherwise the anon
  // client is used and table policies apply.
  return (async () => {
    const mod = await import("@/lib/supabase/server");
    return process.env.SUPABASE_SERVICE_ROLE_KEY
      ? mod.createSupabaseAdminClient()
      : mod.createSupabaseServerClient();
  })();
}

/* ------------------------------------------------------------------ */
/* Local file store (demo / self-hosted)                                */
/* ------------------------------------------------------------------ */

const STORE_VERSION = 1;

function storeFile(): string {
  const dir = process.env.COMMENTS_STORE_DIR ?? path.join(process.cwd(), ".data");
  return path.join(dir, "inspiration-comments.json");
}

interface StoreShape {
  version: number;
  comments: InspirationComment[];
}

/** Single in-process write queue — concurrent POSTs must not clobber the file. */
let writeQueue: Promise<unknown> = Promise.resolve();

function readStore(): StoreShape {
  try {
    const raw = fs.readFileSync(storeFile(), "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    if (parsed && Array.isArray(parsed.comments)) return { version: STORE_VERSION, comments: parsed.comments };
  } catch {
    /* missing or corrupt file → empty store (corrupt data is dropped, not fatal) */
  }
  return { version: STORE_VERSION, comments: [] };
}

function writeStoreSync(store: StoreShape): void {
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file); // atomic on POSIX
}

/** Serialize a mutating operation through the queue; returns its result. */
function enqueue<T>(op: () => T): Promise<T> {
  const run = writeQueue.then(op, op);
  writeQueue = run.catch(() => undefined);
  return run;
}

function makeId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/** All comments of one pin, oldest first, nested one level (comment + replies). */
export async function listThreads(pinId: string): Promise<CommentThread[]> {
  let comments: InspirationComment[];
  if (supabaseConfigured()) {
    const supabase = await supabaseForWrites();
    const { data, error } = await supabase
      .from("inspiration_comments")
      .select("id,pin_id,parent_id,author_name,author_type,body,created_at")
      .eq("pin_id", pinId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    comments = (data ?? []).map((row) => ({
      id: String(row.id),
      pinId: String(row.pin_id),
      parentId: row.parent_id ? String(row.parent_id) : null,
      authorName: String(row.author_name),
      authorType: row.author_type === "user" ? "user" : "guest",
      body: String(row.body),
      createdAt: String(row.created_at),
    }));
  } else {
    comments = readStore().comments
      .filter((c) => c.pinId === pinId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  const byId = new Map(comments.map((c) => [c.id, c]));
  const threads: CommentThread[] = [];
  for (const c of comments) {
    if (c.parentId && byId.has(c.parentId)) continue; // handled as a reply below
    threads.push({ comment: c, replies: [] });
  }
  const threadIndex = new Map(threads.map((t) => [t.comment.id, t]));
  for (const c of comments) {
    if (!c.parentId) continue;
    // reply-to-reply flattens onto the top-level parent (single-level threads)
    const root = byId.get(c.parentId)?.parentId ?? c.parentId;
    threadIndex.get(root)?.replies.push(c);
  }
  return threads;
}

export interface AddCommentInput {
  pinId: string;
  body: string;
  authorName: string;
  parentId?: string | null;
  authorId?: string | null;
}

/** Append one comment; `parentId` must reference a comment of the SAME pin. */
export async function addComment(input: AddCommentInput): Promise<InspirationComment> {
  const body = input.body.trim();
  const authorName = input.authorName.trim();
  if (body.length < COMMENT_BODY_MIN || body.length > COMMENT_BODY_MAX) {
    throw new RangeError("body-length");
  }
  if (authorName.length < COMMENT_NAME_MIN || authorName.length > COMMENT_NAME_MAX) {
    throw new RangeError("name-length");
  }

  const parentId = input.parentId ? String(input.parentId) : null;

  if (supabaseConfigured()) {
    const supabase = await supabaseForWrites();
    if (parentId) {
      const { data: parent, error } = await supabase
        .from("inspiration_comments")
        .select("id,parent_id")
        .eq("id", parentId)
        .eq("pin_id", input.pinId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!parent) throw new RangeError("parent-missing");
    }
    const { data, error } = await supabase
      .from("inspiration_comments")
      .insert({
        pin_id: input.pinId,
        parent_id: parentId,
        author_name: authorName,
        author_type: input.authorId ? "user" : "guest",
        body,
        ...(input.authorId ? { author_id: input.authorId } : {}),
      })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: String(data.id),
      pinId: input.pinId,
      parentId,
      authorName,
      authorType: input.authorId ? "user" : "guest",
      body,
      createdAt: String(data.created_at),
    };
  }

  // Local file store — mutations serialized through the write queue.
  return enqueue(() => {
    const store = readStore();
    if (parentId) {
      const parent = store.comments.find((c) => c.id === parentId && c.pinId === input.pinId);
      if (!parent) throw new RangeError("parent-missing");
    }
    const comment: InspirationComment = {
      id: makeId(),
      pinId: input.pinId,
      parentId: parentId && store.comments.some((c) => c.id === parentId) ? parentId : null,
      authorName,
      authorType: input.authorId ? "user" : "guest",
      body,
      createdAt: new Date().toISOString(),
    };
    // append with single-level invariant (reply-to-reply → top-level parent id kept as-is;
    // listThreads resolves the root), cap the store so the file never grows unbounded
    store.comments.push(comment);
    if (store.comments.length > 5000) store.comments = store.comments.slice(-4000);
    writeStoreSync(store);
    return comment;
  });
}
