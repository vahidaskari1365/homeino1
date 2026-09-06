"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Send, X, CornerDownLeft } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { cn, toFa } from "@/lib/utils";

interface InspirationComment {
  id: string;
  pinId: string;
  parentId: string | null;
  authorName: string;
  authorType: "user" | "guest";
  body: string;
  createdAt: string; // ISO
}

interface CommentThread {
  comment: InspirationComment;
  replies: InspirationComment[];
}

const NAME_KEY = "homeino:comment-name";
const BODY_MAX = 1000;

function faDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

function Avatar({ name, muted = false }: { name: string; muted?: boolean }) {
  const letter = [...name.trim()][0] ?? "؟";
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black",
        muted ? "bg-sand/60 text-ink" : "bg-terracotta/12 text-terracotta-deep"
      )}
    >
      {letter}
    </span>
  );
}

/**
 * Discussion under one pin: flat comment list with one level of replies.
 * Guests can join (name + text); identity resolution happens server-side and
 * logged-in comments get the «کاربر هومینو» badge. All states are honest —
 * network failures show a retry, validation errors surface the API message.
 */
export function CommentsSection({ pinId }: { pinId: string }) {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/inspirations/${encodeURIComponent(pinId)}/comments`);
        const payload = await res.json().catch(() => null);
        const serverMessage: string | null =
          typeof payload?.error?.message === "string" ? payload.error.message
          : typeof payload?.message === "string" ? payload.message
          : null;
        if (!res.ok) {
          if (alive) setLoadError(serverMessage ?? "خواندن گفتگو ناموفق بود.");
          return;
        }
        const items =
          Array.isArray(payload?.data?.items) ? (payload.data.items as CommentThread[])
          : Array.isArray(payload?.items) ? (payload.items as CommentThread[])
          : [];
        if (alive) setThreads(items);
        // prefill the name (async — no hydration mismatch, no sync setState in effect)
        try {
          const saved = window.localStorage.getItem(NAME_KEY);
          if (saved && alive) setName(saved);
        } catch { /* private mode — name stays empty */ }
      } catch {
        if (alive) setLoadError("ارتباط برقرار نشد؛ اینترنت را بررسی کن.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [pinId]);

  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0);

  function startReply(c: InspirationComment) {
    // replies are one level deep — replying to a reply targets the same root
    const rootId = c.parentId ?? c.id;
    setReplyTo({ id: rootId, name: c.authorName });
    setFeedback(null);
    document.getElementById("comment-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function appendLocal(item: InspirationComment) {
    setThreads((prev) => {
      if (!item.parentId) return [...prev, { comment: item, replies: [] }];
      const idx = prev.findIndex((t) => t.comment.id === item.parentId);
      if (idx === -1) return [...prev, { comment: item, replies: [] }];
      const next = [...prev];
      next[idx] = { ...next[idx], replies: [...next[idx].replies, item] };
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    const author = name.trim();
    if (author.length < 2 || author.length > 40) {
      setFeedback({ kind: "error", text: "نام باید بین ۲ تا ۴۰ نویسه باشد." });
      return;
    }
    if (text.length < 2) {
      setFeedback({ kind: "error", text: "متن نظر خیلی کوتاه است." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/inspirations/${encodeURIComponent(pinId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, name: author, parentId: replyTo?.id ?? null }),
      });
      const payload = await res.json().catch(() => null);
      const serverMessage: string | null =
        typeof payload?.error?.message === "string" ? payload.error.message
        : typeof payload?.error === "string" ? payload.error
        : typeof payload?.message === "string" ? payload.message
        : null;
      if (res.ok && payload?.data?.item) {
        appendLocal(payload.data.item as InspirationComment);
        setBody("");
        setReplyTo(null);
        setFeedback({ kind: "success", text: "نظرت ثبت شد — ممنون که به گفتگو اضافه شدی." });
        try { window.localStorage.setItem(NAME_KEY, author); } catch { /* ignore */ }
        return;
      }
      if (res.ok && payload?.item) {
        appendLocal(payload.item as InspirationComment);
        setBody("");
        setReplyTo(null);
        setFeedback({ kind: "success", text: "نظرت ثبت شد — ممنون که به گفتگو اضافه شدی." });
        try { window.localStorage.setItem(NAME_KEY, author); } catch { /* ignore */ }
        return;
      }
      setFeedback({ kind: "error", text: serverMessage ?? "ثبت نظر ناموفق بود؛ دوباره تلاش کن." });
    } catch {
      setFeedback({ kind: "error", text: "ارتباط برقرار نشد؛ اینترنت را بررسی کن و دوباره تلاش کن." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="گفتگو درباره این چیدمان" className="mt-12">
      <div className="rounded-[var(--radius-xl)] card-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-terracotta/10 text-terracotta-deep">
            <MessageCircle size={18} />
          </span>
          <h2 className="font-display text-xl font-black text-ink">گفتگو درباره این چیدمان</h2>
          {total > 0 && (
            <span className="rounded-full bg-ivory-2 px-2.5 py-1 text-2xs font-bold text-ink">
              {toFa(total)} نظر
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          نظرت را بنویس، به دیگران پاسخ بده و درباره این چیدمان گفتگو کن — بدون نیاز به حساب کاربری.
        </p>

        {/* ---- thread list ---- */}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
              <Spinner /> در حال بارگذاری گفتگو…
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-ink">
              {loadError}
            </div>
          ) : total === 0 ? (
            <div className="rounded-2xl border border-dashed border-clay/60 bg-cream/50 p-6 text-center text-sm text-ink-muted">
              هنوز گفتگویی شکل نگرفته — اولین نظر را تو بنویس.
            </div>
          ) : (
            <ul className="space-y-6">
              {threads.map((t) => (
                <li key={t.comment.id}>
                  <CommentRow comment={t.comment} onReply={startReply} />
                  {t.replies.length > 0 && (
                    <div className="ms-4 mt-4 space-y-4 border-s-2 border-clay/40 ps-4 sm:ms-6">
                      {t.replies.map((r) => (
                        <CommentRow key={r.id} comment={r} onReply={startReply} isReply />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- form ---- */}
        <form id="comment-form" onSubmit={submit} className="mt-8 rounded-2xl border border-clay/40 bg-cream/60 p-4 sm:p-5">
          {replyTo && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-ivory-2 px-3 py-2 text-2xs font-bold text-ink">
              <span>در پاسخ به {replyTo.name}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="لغو پاسخ"
                className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition hover:bg-ink hover:text-cream"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
            <div>
              <label htmlFor="comment-name" className="field-label">نام تو <span className="text-terracotta-deep">*</span></label>
              <input
                id="comment-name"
                className="field-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: سارا محمدی"
                maxLength={40}
                required
              />
            </div>
            <div>
              <label htmlFor="comment-body" className="field-label">نظرت</label>
              <textarea
                id="comment-body"
                className="field-control min-h-20 resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={replyTo ? `پاسخت به ${replyTo.name} را بنویس…` : "از این چیدمان چه فکر می‌کنی؟ پیشنهاد یا سؤالی داری؟"}
                maxLength={BODY_MAX}
                required
              />
              <div className="mt-1 text-left text-2xs text-ink-muted">{toFa(body.length)}/{toFa(BODY_MAX)}</div>
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              className={cn(
                "mt-3 rounded-xl border px-4 py-3 text-xs leading-6",
                feedback.kind === "success" ? "border-sage/40 bg-sage/10 text-ink" : "border-danger/30 bg-danger/10 text-ink"
              )}
            >
              <p className="font-bold">{feedback.text}</p>
            </div>
          )}

          <div className="mt-3 flex justify-start">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="border-t-cream" /> : <Send size={15} />}
              {submitting ? "در حال ارسال…" : "ثبت نظر"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  onReply,
  isReply = false,
}: {
  comment: InspirationComment;
  onReply: (c: InspirationComment) => void;
  isReply?: boolean;
}) {
  return (
    <article className="flex gap-3">
      <Avatar name={comment.authorName} muted={isReply} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-black text-ink">{comment.authorName}</span>
          {comment.authorType === "user" && (
            <span className="rounded-full bg-sage/15 px-2 py-0.5 text-2xs font-bold text-success">کاربر هومینو</span>
          )}
          <span className="text-2xs text-ink-muted">{faDate(comment.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-line text-[15px] leading-8 text-ink/90">{comment.body}</p>
        <button
          type="button"
          onClick={() => onReply(comment)}
          className="mt-1.5 inline-flex items-center gap-1 text-2xs font-bold text-terracotta-deep transition hover:text-terracotta"
        >
          <CornerDownLeft size={12} /> پاسخ
        </button>
      </div>
    </article>
  );
}
