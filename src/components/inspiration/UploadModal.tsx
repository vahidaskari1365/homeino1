"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus } from "lucide-react";
import { Modal, Button, Spinner } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { styles } from "@/data/styles";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — mirrors the API validation
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type Status = "idle" | "uploading" | "success" | "error";

/**
 * Upload modal for user pins. Submits multipart FormData to /api/inspirations
 * and surfaces honest states: uploading, success, 503 (feature disabled) and
 * 401 (login required, preserving the return URL).
 */
export function UploadModal({ open, onClose, spaces }: { open: boolean; onClose: () => void; spaces: string[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [styleSlug, setStyleSlug] = useState<string>(styles[0]?.slug ?? "modern");
  const [space, setSpace] = useState(spaces[0] ?? "پذیرایی");
  const [itemsLine, setItemsLine] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blob previews are revoked by the cleanup below on swap/unmount — no manual
  // revocation needed anywhere else (updaters stay pure, no double-revoke).
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function pickFile(next: File | null) {
    setErrorMessage("");
    setNeedsLogin(false);
    if (!next) { setFile(null); setPreview(null); return; }
    if (!ALLOWED_MIME.has(next.type)) {
      setErrorMessage("فرمت عکس باید JPG، PNG یا WebP باشد.");
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setErrorMessage("حجم عکس باید کمتر از ۸ مگابایت باشد.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function close() {
    if (status === "uploading") return; // don't abandon an in-flight upload
    setFile(null);
    setPreview(null); // effect cleanup revokes the blob URL
    setTitle("");
    setDescription("");
    setItemsLine("");
    setStyleSlug(styles[0]?.slug ?? "modern");
    setSpace(spaces[0] ?? "پذیرایی");
    setStatus("idle");
    setErrorMessage("");
    setNeedsLogin(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  async function submit() {
    setErrorMessage("");
    setNeedsLogin(false);
    const trimmedTitle = title.trim();
    if (!file) { setErrorMessage("اول یک عکس انتخاب کن."); return; }
    if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
      setErrorMessage("عنوان باید بین ۳ تا ۱۲۰ نویسه باشد.");
      return;
    }
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("title", trimmedTitle);
      fd.append("description", description.trim());
      fd.append("style", styleSlug);
      fd.append("space", space);
      fd.append("items", itemsLine.trim());
      const res = await fetch("/api/inspirations", { method: "POST", body: fd });
      const payload = await res.json().catch(() => null);
      const serverMessage: string | null =
        typeof payload?.error?.message === "string" ? payload.error.message
        : typeof payload?.error === "string" ? payload.error
        : typeof payload?.message === "string" ? payload.message
        : null;
      if (res.ok) {
        setStatus("success");
        return;
      }
      if (res.status === 503) {
        setStatus("error");
        setErrorMessage(serverMessage ?? "ثبت عکس کاربران به‌زودی فعال می‌شود — فعلاً سردبیر هومینو پین‌ها را منتشر می‌کند.");
        return;
      }
      if (res.status === 401) {
        setStatus("error");
        setNeedsLogin(true);
        setErrorMessage(serverMessage ?? "برای انتشار عکس، اول وارد حساب شوید.");
        return;
      }
      setStatus("error");
      setErrorMessage(serverMessage ?? "ارسال پین ناموفق بود؛ دوباره تلاش کن.");
    } catch {
      setStatus("error");
      setErrorMessage("ارتباط برقرار نشد؛ اینترنت را بررسی کن و دوباره تلاش کن.");
    }
  }

  const returnUrl = typeof window !== "undefined"
    ? window.location.pathname + window.location.search
    : "/inspiration";

  return (
    <Modal
      open={open}
      onClose={close}
      title="عکس خانه‌ات را به اشتراک بگذار"
      description="پین تو پس از بررسی سردبیر هومینو در گالری الهام منتشر می‌شود."
      footer={
        status === "success" ? (
          <Button onClick={close} className="w-full">باشه</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={status === "uploading"}>انصراف</Button>
            <Button onClick={submit} disabled={status === "uploading"}>
              {status === "uploading" ? <Spinner className="border-t-cream" /> : <ImagePlus size={16} />}
              {status === "uploading" ? "در حال ارسال…" : "انتشار پین"}
            </Button>
          </>
        )
      }
    >
      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 size={44} className="text-sage" />
          <p className="text-sm font-bold text-ink">پین تو با موفقیت ثبت شد.</p>
          <p className="max-w-xs text-xs leading-6 text-ink-muted">پس از تأیید سردبیر، پین تو در گالری الهام برای همه نمایش داده می‌شود.</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {/* image picker + preview */}
          <div>
            <span className="field-label">عکس فضا <span className="text-terracotta-deep">*</span></span>
            {preview ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-clay/50">
                <SmartImage src={preview} alt="پیش‌نمایش عکس انتخاب‌شده" className="absolute inset-0 h-full w-full" />
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  className="absolute left-2 top-2 rounded-full bg-ink/80 px-3 py-1 text-2xs font-medium text-cream backdrop-blur"
                >
                  حذف عکس
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-clay/70 bg-cream px-4 py-8 text-center transition hover:border-terracotta">
                <ImagePlus size={26} className="text-ink-muted" />
                <span className="text-sm font-medium text-ink">انتخاب عکس از دستگاه</span>
                <span className="text-2xs text-ink-muted">JPG، PNG یا WebP — حداکثر ۸ مگابایت</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          <div>
            <label htmlFor="pin-title" className="field-label">عنوان پین <span className="text-terracotta-deep">*</span></label>
            <input
              id="pin-title"
              className="field-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: پذیرایی دنج با پالت خاکی"
              maxLength={120}
              required
            />
          </div>

          <div>
            <label htmlFor="pin-description" className="field-label">توضیح چیدمان</label>
            <textarea
              id="pin-description"
              className="field-control min-h-24 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="از رنگ‌ها، نور و وسایلی که این فضا را ساخته‌اند بنویس…"
              maxLength={1000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pin-style" className="field-label">سبک</label>
              <select id="pin-style" className="field-control" value={styleSlug} onChange={(e) => setStyleSlug(e.target.value)}>
                {styles.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pin-space" className="field-label">فضا</label>
              <select id="pin-space" className="field-control" value={space} onChange={(e) => setSpace(e.target.value)}>
                {spaces.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pin-items" className="field-label">وسایل استفاده‌شده <span className="text-ink-muted">(اختیاری)</span></label>
            <input
              id="pin-items"
              className="field-control"
              value={itemsLine}
              onChange={(e) => setItemsLine(e.target.value)}
              placeholder="با ویرگول جدا کن: کاناپه، فرش، آباژور…"
            />
          </div>

          {status === "error" && (
            <div
              role="alert"
              className={cn(
                "rounded-xl border px-4 py-3 text-xs leading-6",
                needsLogin ? "border-gold/40 bg-gold/10 text-ink" : "border-danger/30 bg-danger/10 text-ink"
              )}
            >
              <p className="font-bold">{errorMessage}</p>
              {needsLogin && (
                <Link
                  href={`/login?next=${encodeURIComponent(returnUrl)}`}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-terracotta-deep underline underline-offset-4"
                >
                  ورود به حساب هومینو
                </Link>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
