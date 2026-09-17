"use client";
// ============================================================
// RealInspirationStrip (Task 42) — نوار «الهام واقعی از وب».
// عکس‌های واقعی گوگل (serper.dev) هم‌راستای سبک انتخابی کاربر.
//
// صرفه‌جویی در فری‌تیر: fetch فقط بعد از کلیک کاربر انجام می‌شود.
// صداقت: کامپوننت ۱۰۰٪ تزئینی است — هر خطایی بی‌صدا مخفی می‌شود و
// هیچ‌وقت جلوی طراحی را نمی‌گیرد. عکس‌ها با <img> ساده (نه next/image)
// چون هاست‌های گوگل نامتناهی‌اند و وارد remotePatterns نمی‌شوند.
// ============================================================
import { useEffect, useState } from "react";
import { Camera, ExternalLink, RefreshCw } from "lucide-react";
import { aiService } from "@/services/ai";

interface RealPhoto {
  imageUrl: string;
  title: string;
  source: string;
  link?: string;
}

export function RealInspirationStrip({ styleLabel }: { styleLabel?: string }) {
  const [photos, setPhotos] = useState<RealPhoto[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "hidden">("idle");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (state !== "loading") return;
    let alive = true;
    const q = [styleLabel, "دکوراسیون داخلی"].filter(Boolean).join(" ");
    aiService.searchImages({ query: q, num: 8 })
      .then((res) => {
        if (!alive) return;
        const imgs = (res.images ?? []).filter((i) => Boolean(i.imageUrl)).slice(0, 8);
        setPhotos(imgs);
        setState("done");
      })
      .catch(() => { if (alive) setState("hidden"); });
    return () => { alive = false; };
  }, [state, reload, styleLabel]);

  if (state === "hidden") return null;

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("loading")}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-clay/70 bg-cream px-4 py-3 text-sm font-bold text-ink-muted transition hover:border-terracotta hover:text-terracotta-deep"
      >
        <Camera size={16} />
        الهام واقعی از وب برای سبک «{styleLabel || "دلخواه"}» ببین
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-clay/50 bg-cream p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Camera size={15} className="text-terracotta-deep" />
          الهام واقعی از وب {styleLabel ? `— سبک ${styleLabel}` : ""}
        </div>
        <button
          onClick={() => { setPhotos([]); setReload((r) => r + 1); setState("loading"); }}
          className="flex items-center gap-1 text-2xs text-ink-muted transition hover:text-terracotta-deep"
          aria-label="جست‌وجوی دوباره"
        >
          <RefreshCw size={12} /> جست‌وجوی دوباره
        </button>
      </div>
      {state === "loading" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-sand/60" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="py-2 text-center text-xs text-ink-muted">فعلاً عکسی پیدا نشد — دوباره امتحان کن.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <a
              key={p.imageUrl}
              href={p.link || p.imageUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group relative overflow-hidden rounded-lg border border-clay/40"
              title={p.title || p.source}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt={p.title || "الهام دکوراسیون"}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent px-1.5 pb-1 pt-4 text-2xs text-cream">
                <span className="truncate">{p.source || "وب"}</span>
                <ExternalLink size={10} className="shrink-0 opacity-70" />
              </span>
            </a>
          ))}
        </div>
      )}
      <p className="mt-2 text-2xs leading-5 text-ink-muted">
        این عکس‌ها واقعی و از منابع وب هستند — برای مرجع و ایده، نه نتیجه‌ی طراحی.
      </p>
    </div>
  );
}
