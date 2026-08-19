"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Upload, Wand2, Download, Heart, History, Sparkles, Loader2, Check,
  AlertCircle, RefreshCw, CreditCard, Layers, ImagePlus,
} from "lucide-react";
import { Container } from "@/components/shared";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { useCredits, useUi } from "@/stores/useApp";
import { useWishlist } from "@/stores/useShop";
import { useAiHistory } from "@/stores/useAiHistory";
import { costOf } from "@/services/ai/credits";
import { runDesignPipeline, type AiJobState } from "@/services/ai/pipeline";
import type { OverlayMetadata } from "@/services/ai/orali";
import type { StructuredIntent } from "@/services/ai/intentSchema";
import { cn, toFa } from "@/lib/utils";

const ROOMS = [
  ["living", "نشیمن"],
  ["bedroom", "خواب"],
  ["kitchen", "آشپزخانه"],
  ["dining", "ناهارخوری"],
  ["office", "کار"],
  ["bath", "حمام"],
] as const;

const STYLES = [
  ["modern", "مدرن"],
  ["minimal", "مینیمال"],
  ["classic", "کلاسیک"],
  ["scandi", "اسکاندیناوی"],
  ["luxury", "لوکس"],
  ["industrial", "صنعتی"],
] as const;

const COLORS = [
  { id: "cream", hex: "#E8DCC8", label: "کرم" },
  { id: "sage", hex: "#1E5D44", label: "سبز" },
  { id: "gold", hex: "#BE9A4F", label: "طلایی" },
  { id: "ink", hex: "#1C1916", label: "مشکی" },
  { id: "sand", hex: "#C4A574", label: "شنی" },
  { id: "clay", hex: "#8B5E3C", label: "خاکی" },
];

const CHANGE_TYPES = [
  ["object", "تعویض وسیله"],
  ["color", "تغییر رنگ"],
  ["style", "تغییر سبک"],
  ["light", "نورپردازی"],
] as const;

const STATE_COPY: Record<AiJobState, string> = {
  idle: "",
  uploading: "در حال بارگذاری تصویر…",
  analyzing: "تحلیل فضا و معماری…",
  understanding: "فهم درخواست — فقط همان چیزی که گفتی تغییر می‌کند",
  generating: "تولید تصویر و لایه Overlay…",
  processing: "اعتبارسنجی نتیجه…",
  success: "آماده شد",
  "partial-success": "پیش‌نمایش آماده شد",
  error: "خطا در تولید",
  retry: "تلاش مجدد…",
  "no-result": "نتیجه‌ای برنگشت",
};

export default function AIDesignerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useUi();
  const balance = useCredits((s) => s.balance);
  const wl = useWishlist();
  const history = useAiHistory();

  const [image, setImage] = useState<string | null>(null);
  const [room, setRoom] = useState("living");
  const [style, setStyle] = useState("modern");
  const [colors, setColors] = useState<string[]>([]);
  const [changeType, setChangeType] = useState("object");
  const [prompt, setPrompt] = useState("");
  const [keep, setKeep] = useState("");
  const [change, setChange] = useState("");
  const [job, setJob] = useState<AiJobState>("idle");
  const [result, setResult] = useState<{
    original: string;
    generated: string;
    overlay: OverlayMetadata;
    intent: StructuredIntent;
    preview: boolean;
  } | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  const cost = costOf("generate");
  const busy = ["uploading", "analyzing", "understanding", "generating", "processing", "retry"].includes(job);

  const handleFile = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast("فقط JPG، PNG یا WEBP", "error");
    if (file.size > 10 * 1024 * 1024) return toast("حداکثر ۱۰ مگابایت", "error");
    setJob("uploading");
    const r = new FileReader();
    r.onload = () => {
      setImage(r.result as string);
      setResult(null);
      setJob("idle");
    };
    r.readAsDataURL(file);
  };

  const toggleColor = (id: string) =>
    setColors((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const generate = async () => {
    if (!image) return toast("اول عکس اتاق را آپلود کن", "error");
    if (!prompt.trim() && !change.trim()) return toast("دستور یا محدوده تغییر را بنویس", "error");
    if (useCredits.getState().balance < cost) {
      setInsufficient(true);
      setJob("error");
      return;
    }
    setInsufficient(false);
    setJob("analyzing");
    const op = await useCredits.getState().runAiOperation("طراحی AI", cost, async () =>
      runDesignPipeline(
        {
          originalImage: image,
          prompt: prompt || change,
          style,
          roomType: room,
          colors,
          keep,
          change,
        },
        setJob,
      ),
    );
    if (!op.ok) {
      if (op.reason === "insufficient") setInsufficient(true);
      setJob("error");
      return toast("اعتبار کافی نیست یا خطا رخ داد", "error");
    }
    const r = op.result;
    setResult({
      original: r.originalImage,
      generated: r.generatedImage,
      overlay: r.overlay,
      intent: r.intent,
      preview: r.preview,
    });
    history.add({
      thumbnail: r.generatedImage,
      prompt: prompt || change,
      style,
      status: r.status === "success" ? "success" : r.status === "error" ? "error" : "partial-success",
      originalImage: r.originalImage,
      generatedImage: r.generatedImage,
      overlay: r.overlay,
      intent: r.intent,
    });
    toast(r.preview ? "پیش‌نمایش آماده شد" : "طراحی آماده شد");
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.generated;
    a.download = "homeino-ai-design.png";
    a.click();
    toast("دانلود شروع شد");
  };

  const saveWishlist = () => {
    if (!result) return;
    wl.toggleDesign(result.generated.slice(0, 24));
    toast("به مجموعه اضافه شد");
  };

  const reopen = (id: string) => {
    const item = history.get(id);
    if (!item) return;
    setImage(item.originalImage);
    setPrompt(item.prompt);
    setStyle(item.style);
    setResult({
      original: item.originalImage,
      generated: item.generatedImage,
      overlay: item.overlay ?? { version: 1, regions: [], preservedArchitecture: true, provider: "mock" },
      intent: item.intent ?? { intent: "unclear", target: [], changes: [], preservedElements: [], colors: [], confidence: 0, scope: "local" },
      preview: item.status !== "success",
    });
    setJob("success");
  };

  const panel = "rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)]";

  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-cream">
              <Wand2 size={18} />
            </span>
            <div>
              <h1 className="font-display text-xl font-black text-ink">AI Designer</h1>
              <p className="text-[11px] text-ink-muted">مستقیم طراحی کن — بدون صفحه معرفی</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ai/history" className="inline-flex items-center gap-1.5 rounded-lg border border-clay/50 bg-cream px-3 py-2 text-[11px] font-bold text-ink">
              <History size={14} /> تاریخچه
            </Link>
            <div className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-center">
              <div className="text-[10px] text-ink-muted">اعتبار</div>
              <div className="font-display text-sm font-black text-gold">{toFa(balance)}</div>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <div className={panel}>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
                <ImagePlus size={14} /> تصویر اتاق
              </h2>
              {!image ? (
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-10 text-center hover:border-terracotta"
                >
                  <Upload size={22} className="mb-2 text-ink-muted" />
                  <p className="text-xs font-medium text-ink">آپلود یا رها کردن عکس</p>
                  <p className="mt-1 text-[10px] text-ink-muted">JPG · PNG · WEBP</p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-clay/40">
                  <img src={image} alt="پیش‌نمایش اتاق" className="aspect-video w-full object-cover" />
                  <button onClick={() => { setImage(null); setResult(null); }} className="absolute left-2 top-2 rounded-md bg-ink/70 px-2 py-1 text-[10px] text-cream">حذف</button>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>

            <div className={panel}>
              <h2 className="mb-2 text-xs font-bold text-ink">نوع فضا</h2>
              <div className="flex flex-wrap gap-1.5">
                {ROOMS.map(([id, label]) => (
                  <button key={id} onClick={() => setRoom(id)} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-bold", room === id ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 text-ink-muted")}>{label}</button>
                ))}
              </div>
            </div>

            <div className={panel}>
              <h2 className="mb-2 text-xs font-bold text-ink">سبک</h2>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map(([id, label]) => (
                  <button key={id} onClick={() => setStyle(id)} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-bold", style === id ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 text-ink-muted")}>{label}</button>
                ))}
              </div>
            </div>

            <div className={panel}>
              <h2 className="mb-2 text-xs font-bold text-ink">رنگ‌ها</h2>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c.id} onClick={() => toggleColor(c.id)} className={cn("flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px]", colors.includes(c.id) ? "border-ink" : "border-clay/40")} title={c.label}>
                    <span className="h-3.5 w-3.5 rounded-full border border-clay/40" style={{ background: c.hex }} />
                    {c.label}
                    {colors.includes(c.id) && <Check size={10} />}
                  </button>
                ))}
              </div>
            </div>

            <div className={panel}>
              <h2 className="mb-2 text-xs font-bold text-ink">نوع تغییر</h2>
              <div className="grid grid-cols-2 gap-1.5">
                {CHANGE_TYPES.map(([id, label]) => (
                  <button key={id} onClick={() => setChangeType(id)} className={cn("rounded-lg border py-2 text-[11px] font-bold", changeType === id ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 text-ink-muted")}>{label}</button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-ink-muted">اگر بگویی «مبل را عوض کن» فقط مبل عوض می‌شود. بازطراحی گسترده فقط با درخواست صریح مثل «این اتاق را مدرن کن».</p>
            </div>

            <div className={panel}>
              <label className="mb-1 block text-[10px] font-bold text-ink-muted">دستور متنی</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="مثلاً مبل را عوض کن / رنگ دیوار را کرم کن" className="mb-2 w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2 text-xs outline-none focus:border-terracotta" />
              <label className="mb-1 block text-[10px] font-bold text-ink-muted">چه چیزی حفظ شود</label>
              <input value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="پنجره، کف، چیدمان…" className="mb-2 w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2 text-xs outline-none focus:border-terracotta" />
              <label className="mb-1 block text-[10px] font-bold text-ink-muted">چه چیزی تغییر کند</label>
              <input value={change} onChange={(e) => setChange(e.target.value)} placeholder="مبل، فرش، رنگ دیوار…" className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2 text-xs outline-none focus:border-terracotta" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gold/25 bg-gold/5 px-3 py-2 text-[11px]">
              <span className="text-ink-muted">هزینه این تولید</span>
              <span className="font-black text-gold">{toFa(cost)} اعتبار</span>
            </div>

            <button onClick={generate} disabled={busy || !image} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm font-black disabled:opacity-40">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              {result ? "اعمال تغییر" : "طراحی کن"}
            </button>
          </div>

          <div className="space-y-3 lg:col-span-7">
            <div className={panel}>
              <div className="mb-3 flex items-center justify-between border-b border-clay/30 pb-2">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink"><Layers size={14} className="text-terracotta-deep" /> نتیجه</h3>
                {result && (
                  <div className="flex gap-1">
                    <button onClick={download} className="grid h-8 w-8 place-items-center rounded-md bg-ivory-2" aria-label="دانلود"><Download size={14} /></button>
                    <button onClick={saveWishlist} className="grid h-8 w-8 place-items-center rounded-md bg-ivory-2" aria-label="مجموعه"><Heart size={14} /></button>
                    <button onClick={() => { setPrompt((p) => p || "کمی گرم‌تر کن"); }} className="grid h-8 w-8 place-items-center rounded-md bg-ivory-2" aria-label="ویرایش مجدد"><RefreshCw size={14} /></button>
                  </div>
                )}
              </div>

              {busy && (
                <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-ink text-cream">
                  <Loader2 className="mb-3 animate-spin text-gold" size={28} />
                  <p className="text-sm font-bold">{STATE_COPY[job]}</p>
                  <div className="mt-4 flex gap-1">
                    {["analyzing", "understanding", "generating", "processing"].map((s) => (
                      <span key={s} className={cn("h-1.5 w-8 rounded-full", job === s ? "bg-gold" : "bg-white/20")} />
                    ))}
                  </div>
                </div>
              )}

              {!busy && result && (
                <BeforeAfterSlider before={result.original} after={result.generated} />
              )}

              {!busy && !result && (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-clay/50 bg-ivory-2">
                  <p className="text-xs text-ink-muted">نتیجه اینجا دیده می‌شود</p>
                </div>
              )}

              {result?.preview && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-gold"><AlertCircle size={12} /> Overlay و تصویر برای اتصال Orali آماده است — پیش‌نمایش صادقانه</div>
              )}

              {result?.overlay.regions.length ? (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-bold text-ink-muted">مناطق قابل ویرایش (metadata)</p>
                  <div className="flex flex-wrap gap-1">
                    {result.overlay.regions.map((r) => (
                      <span key={r.id} className="rounded-md bg-ivory-2 px-2 py-0.5 text-[10px]">{r.label}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {result?.intent && (
                <div className="mt-3 rounded-lg bg-ivory-2 p-2.5 text-[10px] leading-5 text-ink-muted">
                  <span className="font-bold text-ink">Intent:</span> {result.intent.intent} · scope {result.intent.scope} · حفظ: {result.intent.preservedElements.slice(0, 6).join("، ")}
                </div>
              )}
            </div>

            {insufficient && (
              <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
                <h3 className="font-display font-bold text-ink">اعتبار کافی نیست</h3>
                <p className="mt-1 text-xs text-ink-muted">برای این تولید به {toFa(cost)} اعتبار نیاز است. موجودی فعلی: {toFa(balance)}</p>
                <Link href="/account/credits" className="btn-accent mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold">
                  <CreditCard size={14} /> خرید اعتبار
                </Link>
              </div>
            )}

            {(job === "error" || job === "no-result") && !insufficient && (
              <button onClick={() => { setJob("retry"); generate(); }} className="w-full rounded-xl border border-clay/50 py-2 text-xs font-bold">تلاش مجدد</button>
            )}

            <div className="flex items-center justify-between rounded-xl border border-clay/40 bg-cream px-3 py-2 text-[11px]">
              <span className="text-ink-muted">اعتبار باقی‌مانده</span>
              <span className="font-black text-ink">{toFa(balance)}</span>
            </div>

            <div className={panel}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink"><History size={13} /> طراحی‌های قبلی</h3>
                <Link href="/ai/history" className="text-[10px] text-terracotta-deep">همه</Link>
              </div>
              {history.items.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-ink-muted">هنوز تاریخچه‌ای نیست</p>
              ) : (
                <div className="space-y-2">
                  {history.items.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg border border-clay/30 bg-ivory-2 p-2">
                      <img src={h.thumbnail} alt="" className="h-12 w-12 rounded-md object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-ink">{h.prompt || "بدون دستور"}</p>
                        <p className="text-[10px] text-ink-muted">{h.date} · {h.style} · {h.status}</p>
                      </div>
                      <button onClick={() => reopen(h.id)} className="text-[10px] font-bold text-terracotta-deep">بازگشایی</button>
                      <button onClick={() => history.remove(h.id)} className="text-[10px] text-danger">حذف</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-ink-muted">محصولات استفاده‌شده در نسخه بعدی به همین نتیجه وصل می‌شوند.</p>
          </div>
        </div>
      </Container>
    </div>
  );
}
