"use client";
// ============================================================
// AI DESIGNER — /ai  →  the AI product itself.
//
// This IS the main AI experience: clicking «هوش مصنوعی» lands
// directly here. No intro page, no explanation hop, no extra
// steps. One screen: upload → describe → طراحی کن → result.
//
// Capabilities: upload · preview · room type · style · colors ·
// change type · prompt · preserve/change spec · AI result ·
// before/after · save · re-edit · download · wishlist · products.
//
// Architecture: this page NEVER talks to a provider directly.
//   UI → aiService → /api/ai → Pipeline → { LLM Service · Orali · Provider }
// ============================================================
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Upload, Wand2, Sparkles, Loader2, Download, Share2, Heart, History, CreditCard,
  X, Check, AlertTriangle, RefreshCw, Pencil, ShoppingBag, Lock, Image as ImageIcon,
  Coins, RotateCcw, ChevronLeft, Palette, Sofa, Layers, type LucideIcon,
} from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { AiPhaseLoader } from "@/components/ai/AiPhaseLoader";
import { IntentCard, TargetPicker } from "@/components/ai/IntentCard";
import { OverlayRegionsView } from "@/components/ai/OverlayRegionsView";
import { aiService, isBusyPhase, type AiPhase, type IntentAnalysis, type PipelineResult } from "@/services/ai";
import { heuristicUnderstandIntent } from "@/services/ai/llm/heuristicLlm";
import { costOf } from "@/services/ai/credits";
import type { RoomElement } from "@/services/ai/roomState";
import { ELEMENT_LABELS } from "@/services/ai/roomState";
import { useCredits, useUi } from "@/stores/useApp";
import { useWishlist } from "@/stores/useShop";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { ROOM_TYPES, STYLES, COLOR_SWATCHES, QUICK_PROMPTS, ARCH_LOCKS } from "@/app/ai/page-config";
import { compressImage, downloadImage } from "@/lib/image";
import { shareContent, buildShareUrl } from "@/lib/share";
import { trackEvent } from "@/lib/tracking";
import { toFa, cn } from "@/lib/utils";

/* ---------------- limits ---------------- */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/* ============================================================
   PAGE
   ============================================================ */

function DesignerInner() {
  const sp = useSearchParams();

  /* ---- restore a previous session (?session=id) → continue editing.
     Lazy initial state — no effect-setState cascade, no extra render. ---- */
  const [restored] = useState(() => {
    const id = sp.get("session");
    if (!id) return null;
    const s = useDesignSessions.getState().sessions.find((x) => x.id === id);
    if (!s) return null;
    return {
      roomType: ROOM_TYPES.some((r) => r.id === s.roomType) ? s.roomType : "living",
      styleId: STYLES.some((x) => x.id === s.style) ? s.style : "modern",
      colors: (s.colors ?? []).filter((c) => COLOR_SWATCHES.some((x) => x.id === c)),
      scope: s.scope,
      targets: s.targets ?? [],
      prompt: s.prompt,
      image: s.beforeImage,
    };
  });

  // ---- inputs ----
  const [imageBase64, setImageBase64] = useState<string | null>(restored?.image ?? null); // uploaded room photo
  const [baseImage, setBaseImage] = useState<string | null>(restored?.image ?? null);     // working base (upload or previous result)
  const [iteration, setIteration] = useState(restored ? 1 : 0);                           // re-edit chain depth
  const [roomType, setRoomType] = useState<string>(restored?.roomType ?? "living");
  const [styleId, setStyleId] = useState<string>(restored?.styleId ?? "modern");
  const [colors, setColors] = useState<string[]>(restored?.colors ?? []);
  const [scope, setScope] = useState<"targeted" | "full">(restored?.scope ?? "targeted");
  const [targets, setTargets] = useState<RoomElement[]>(restored?.targets ?? []);
  const [prompt, setPrompt] = useState(restored?.prompt ?? "");

  // ---- AI run ----
  const [phase, setPhase] = useState<AiPhase>("idle");
  const [intent, setIntent] = useState<IntentAnalysis | null>(null);
  const [understanding, setUnderstanding] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resultView, setResultView] = useState<"result" | "compare" | "regions">("result");
  const [savedId, setSavedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { toast } = useUi();
  const balance = useCredits((s) => s.balance);
  const runAiOperation = useCredits((s) => s.runAiOperation);
  const saveSession = useDesignSessions((s) => s.saveSession);
  const wl = useWishlist();

  const styleLabel = STYLES.find((s) => s.id === styleId)?.label ?? styleId;
  const roomLabel = ROOM_TYPES.find((r) => r.id === roomType)?.label ?? roomType;
  const colorLabels = useMemo(() => colors.map((id) => COLOR_SWATCHES.find((c) => c.id === id)?.label ?? id), [colors]);
  const cost = costOf(scope === "full" ? "generate" : "edit");
  const insufficient = balance < cost;
  const busy = isBusyPhase(phase);
  const canGenerate = Boolean(baseImage) && !busy && !insufficient;

  // Stable keys so the intent memo below uses simple dependency expressions.
  const colorsKey = colors.join(",");
  const targetsKey = targets.join(",");

  const intentRequest = useMemo(() => ({
    prompt, style: styleLabel, room: roomLabel, colors: colorLabels,
    changeScope: scope, selectedTargets: scope === "targeted" ? targets : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [prompt, styleLabel, roomLabel, colorsKey, scope, targetsKey]);

  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => toast("طراحی قبلی بارگذاری شد — ادامه بده"), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  /* ---- AUTO INTENT UNDERSTANDING (free, debounced, before every generation) ---- */
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!prompt.trim() && targets.length === 0) {
        setIntent(null);
        setUnderstanding(false);
        return;
      }
      setUnderstanding(true);
      try {
        const analysis = await aiService.understand(intentRequest).catch(() => heuristicUnderstandIntent(intentRequest));
        if (!cancelled) setIntent(analysis);
      } finally {
        if (!cancelled) setUnderstanding(false);
      }
    }, 900);
    return () => { cancelled = true; clearTimeout(t); };
  }, [intentRequest, prompt, targets.length]);

  /* ---- helpers ---- */

  const handleFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) return toast("فقط JPG، PNG یا WEBP", "error");
    if (file.size > MAX_FILE_SIZE) return toast("حداکثر حجم تصویر ۱۰ مگابایت", "error");
    setPhase("uploading");
    const r = new FileReader();
    r.onerror = () => { setPhase("idle"); toast("خطا در خواندن فایل", "error"); };
    r.onload = () => {
      const d = r.result as string;
      setImageBase64(d);
      setBaseImage(d);
      setIteration(0);
      setResult(null);
      setSavedId(null);
      setResultView("result");
      setPhase("idle");
      trackEvent("room_uploaded", { metadata: { name: file.name, size: file.size } });
    };
    r.readAsDataURL(file);
  };

  const toggleColor = (id: string) => setColors((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));

  const applyQuickPrompt = (q: (typeof QUICK_PROMPTS)[number]) => {
    setPrompt(q.label);
    setScope(q.scope);
    if (q.targets) setTargets(q.targets);
    if (q.colors) setColors(q.colors.map((c) => COLOR_SWATCHES.find((s) => s.label === c)?.id ?? c));
    setIntent(null); // re-run understanding with the new inputs
  };

  /* ---- GENERATE — the primary action ---- */
  const generate = async () => {
    if (!baseImage) return toast("اول عکس اتاقت را آپلود کن", "error");
    if (insufficient) return toast("اعتبار کافی نیست — اول اعتبار بخر", "error");

    trackEvent("ai_design_started", { metadata: { scope, style: styleLabel, targets: targets.join(","), iteration } });
    setResult(null);
    setSavedId(null);

    // 1) UNDERSTAND — confirm intent right before generating (never skip).
    setPhase("understanding");
    let confirmed = intent;
    if (!confirmed) {
      confirmed = await aiService.understand(intentRequest).catch(() => heuristicUnderstandIntent(intentRequest));
      setIntent(confirmed);
    }

    // 2+3) GENERATE + PROCESS via the server pipeline (credits reserved → refund on failure).
    setPhase("generating");
    const started = Date.now();
    const op = await runAiOperation(
      scope === "full" ? "طراحی کامل اتاق" : `اعمال تغییر: ${targets.map((t) => ELEMENT_LABELS[t]).join("، ") || "دستور کاربر"}`,
      cost,
      async () => {
        const res = await aiService.pipeline({
          prompt,
          room: roomLabel,
          style: styleLabel,
          colors: colorLabels,
          scope,
          targets: scope === "targeted" ? targets : undefined,
          referenceImage: baseImage,
          intent: confirmed ?? undefined,
        });
        // Guarantee the "processing" phase is visible — the page must never just flash.
        const minShow = 1400;
        const elapsed = Date.now() - started;
        if (elapsed < minShow) {
          setPhase("processing");
          await new Promise((r) => setTimeout(r, Math.max(400, minShow - elapsed)));
        }
        return res;
      },
    );

    if (!op.ok) {
      if (op.reason === "insufficient") {
        setErrorMsg("اعتبار کافی نیست. این تولید " + toFa(cost) + " اعتبار لازم دارد.");
        setPhase("error");
        return;
      }
      setErrorMsg("تولید انجام نشد و اعتبارت برگشت داده شد. دوباره تلاش کن.");
      setPhase("error");
      trackEvent("ai_design_failed", {});
      return;
    }

    const res = op.result;

    // 4) VALIDATE → final honest state.
    setPhase("processing");
    await new Promise((r) => setTimeout(r, 450));
    if (res.validation.status === "failed" || !res.result.afterImage) {
      setErrorMsg("موتور تصویر نتیجه‌ای برنگرداند. دستور را ساده‌تر کن یا دوباره تلاش کن.");
      setPhase("no-result");
      trackEvent("ai_design_no_result", {});
      return;
    }

    setResult(res);
    setResultView(res.result.beforeImage ? "compare" : "result");
    setPhase(res.validation.status === "completed" ? "success" : "partial-success");

    // 5) SAVE to history (compressed) — capability 12.
    try {
      const [before, after] = await Promise.all([
        compressImage(res.result.beforeImage ?? baseImage, 1024, 0.78),
        compressImage(res.result.afterImage, 1024, 0.82),
      ]);
      const id = saveSession({
        title: prompt.trim() || (scope === "full" ? `بازطراحی ${roomLabel}` : `تغییر ${targets.map((t) => ELEMENT_LABELS[t]).join("، ") || "درخواستی"}`),
        prompt,
        roomType,
        style: styleId,
        colors,
        scope,
        targets,
        status: res.validation.status === "completed" ? "success" : "partial-success",
        beforeImage: before,
        afterImage: after,
        regions: res.result.regions ?? [],
        products: res.result.products ?? [],
        creditsUsed: res.creditsCost,
        preview: res.result.preview,
        intentSummary: res.instruction.targets.map((t) => ELEMENT_LABELS[t]).join("، "),
        imageEngine: res.imageEngine,
      });
      setSavedId(id);
    } catch { /* history save is non-critical */ }

    trackEvent("ai_design_finished", { metadata: { outcome: res.validation.status, engine: res.imageEngine } });
    toast(res.validation.status === "completed" ? "طراحی آماده شد" : "پیش‌نمایش آماده شد — موتور واقعی متصل نیست");
  };

  const retry = async () => {
    setPhase("retry");
    await new Promise((r) => setTimeout(r, 500));
    generate();
  };

  /* ---- result actions (capabilities 12–16) ---- */

  const reEdit = () => {
    if (!result) return;
    setBaseImage(result.result.afterImage);
    setIteration((i) => i + 1);
    setResult(null);
    setIntent(null);
    setPhase("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("نتیجه، پایه‌ی ویرایش جدید شد — دستور بعدی‌ات را بنویس");
  };

  const onDownload = async () => {
    if (!result) return;
    const ok = await downloadImage(result.result.afterImage, `homeino-design-${Date.now()}.png`);
    toast(ok ? "دانلود آغاز شد" : "دانلود ممکن نشد", ok ? "success" : "error");
  };

  const onWishlist = () => {
    if (!savedId) return toast("اول اجازه بده طراحی در تاریخچه ذخیره شود", "error");
    wl.toggleDesign(savedId);
    toast(wl.designs.includes(savedId) ? "به مجموعه اضافه شد" : "از مجموعه حذف شد");
  };

  const onShare = async () => {
    const res = await shareContent({ title: "طراحی هوشمند خانه من", text: "با Homeino طراحی کردم", url: buildShareUrl("/ai") });
    toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا در اشتراک‌گذاری", res.method === "failed" ? "error" : "success");
  };

  /* ---- render ---- */

  const panel = "rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)]";

  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-6">
        <div className="mb-4 [&_a]:text-ink-muted"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "طراحی هوشمند اتاق" }]} /></div>

        {/* ---- header ---- */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-cream"><Wand2 size={19} /></span>
            <div>
              <h1 className="font-display text-lg font-black leading-tight text-ink">طراحی هوشمند اتاق</h1>
              <p className="text-[11px] text-ink-muted">عکس اتاقت را بده، بگو چه چیزی تغییر کند — فقط همان تغییر می‌کند.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ai/history" className="flex items-center gap-1.5 rounded-xl border border-clay/50 bg-cream px-3 py-2 text-[11px] font-bold text-ink-muted transition hover:text-ink">
              <History size={13} /> تاریخچه
            </Link>
            <Link href="/account/credits" className="flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-bold text-gold transition hover:bg-gold/20">
              <Coins size={13} /> {toFa(balance)} اعتبار
            </Link>
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          {/* ============ LEFT: controls — one simple flow ============ */}
          <div className="space-y-3 lg:col-span-5">
            {/* 1 · upload + preview */}
            <section className={panel} aria-label="تصویر اتاق">
              {!baseImage ? (
                <div
                  onClick={() => !busy && inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !busy) handleFile(f); }}
                  className={cn("flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed py-10 text-center transition", phase === "uploading" ? "border-terracotta bg-terracotta/5" : "border-clay/60 bg-ivory-2 hover:border-terracotta")}
                >
                  {phase === "uploading" ? <Loader2 size={26} className="mb-2 animate-spin text-terracotta-deep" /> : <Upload size={26} className="mb-2 text-ink-muted" />}
                  <p className="text-xs font-bold text-ink">{phase === "uploading" ? "در حال بارگذاری…" : "عکس اتاقت را اینجا بنداز یا کلیک کن"}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">JPG · PNG · WEBP — حداکثر ۱۰ مگابایت</p>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-clay/40">
                  <img src={baseImage} alt="پیش‌نمایش اتاق" className="aspect-video w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/70 to-transparent px-3 pb-2 pt-8">
                    <span className="text-[10px] font-bold text-cream">
                      {iteration > 0 ? `پایه‌ی ویرایش — مرحله ${toFa(iteration + 1)}` : "پیش‌نمایش تصویر آپلودشده"}
                    </span>
                    <button
                      onClick={() => { setImageBase64(null); setBaseImage(null); setResult(null); setIteration(0); }}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[10px] font-bold text-cream backdrop-blur transition hover:bg-danger/80 disabled:opacity-40"
                    >
                      <X size={11} /> حذف
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 2+3 · room type + style */}
            <section className={panel} aria-label="نوع فضا و سبک">
              <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><ImageIcon size={13} className="text-terracotta-deep" /> نوع فضا</h2>
              <div className="flex flex-wrap gap-1">
                {ROOM_TYPES.map((r) => (
                  <button key={r.id} onClick={() => setRoomType(r.id)} disabled={busy}
                    className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40", roomType === r.id ? "border-ink bg-ink text-cream" : "border-clay/50 bg-ivory-2 text-ink-muted hover:border-ink/40 hover:text-ink")}>
                    {r.label}
                  </button>
                ))}
              </div>

              <h2 className="mb-2 mt-4 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><Sparkles size={13} className="text-terracotta-deep" /> سبک طراحی</h2>
              <div className="grid grid-cols-4 gap-1.5">
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyleId(s.id)} disabled={busy}
                    className={cn("overflow-hidden rounded-lg border transition disabled:opacity-40", styleId === s.id ? "border-terracotta ring-1 ring-terracotta/40" : "border-clay/40 hover:border-terracotta/50")}>
                    <span className="relative block aspect-square">
                      <img src={s.image} alt={s.label} className="h-full w-full object-cover" />
                      {styleId === s.id && <span className="absolute inset-0 grid place-items-center bg-terracotta/25"><Check size={14} className="text-white drop-shadow" /></span>}
                    </span>
                    <span className="block bg-ivory-2 py-0.5 text-[9px] font-bold text-ink">{s.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 4 · colors */}
            <section className={panel} aria-label="رنگ‌ها">
              <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><Palette size={13} className="text-terracotta-deep" /> رنگ‌ها <span className="font-normal text-ink-muted">(اختیاری — چندتایی)</span></h2>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => {
                  const on = colors.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleColor(c.id)} disabled={busy}
                      className={cn("flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-[11px] font-bold transition disabled:opacity-40", on ? "border-ink bg-ink text-cream" : "border-clay/50 bg-ivory-2 text-ink-muted hover:border-ink/40")}
                      aria-pressed={on}>
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: c.hex }} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 5+8+9 · change type + preserve/change spec */}
            <section className={panel} aria-label="نوع تغییر">
              <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><Layers size={13} className="text-terracotta-deep" /> نوع تغییر</h2>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setScope("targeted")} disabled={busy}
                  className={cn("rounded-xl border p-3 text-right transition disabled:opacity-40", scope === "targeted" ? "border-terracotta bg-terracotta/8 ring-1 ring-terracotta/30" : "border-clay/50 bg-ivory-2 hover:border-terracotta/40")}>
                  <span className="flex items-center gap-1.5 text-xs font-black text-ink"><Sofa size={14} className="text-terracotta-deep" /> تغییر هدفمند</span>
                  <span className="mt-1 block text-[10px] leading-5 text-ink-muted">فقط همان‌هایی که انتخاب می‌کنی عوض می‌شوند</span>
                </button>
                <button onClick={() => setScope("full")} disabled={busy}
                  className={cn("rounded-xl border p-3 text-right transition disabled:opacity-40", scope === "full" ? "border-terracotta bg-terracotta/8 ring-1 ring-terracotta/30" : "border-clay/50 bg-ivory-2 hover:border-terracotta/40")}>
                  <span className="flex items-center gap-1.5 text-xs font-black text-ink"><Wand2 size={14} className="text-terracotta-deep" /> بازطراحی کامل</span>
                  <span className="mt-1 block text-[10px] leading-5 text-ink-muted">اجازه تغییر کل فضا با سبک انتخابی</span>
                </button>
              </div>

              {scope === "targeted" && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-bold text-ink-muted">چه چیزی تغییر کند؟</p>
                  <TargetPicker value={targets} onChange={setTargets} disabled={busy} />
                </div>
              )}

              <div className="mt-3 rounded-xl bg-ivory-2 p-2.5">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-ink"><Lock size={10} className="text-sage-deep" /> همیشه حفظ می‌شود {scope === "full" ? "(در بازطراحی کامل استثنا دار)" : ""}:</p>
                <div className="flex flex-wrap gap-1">
                  {ARCH_LOCKS.map((l) => (
                    <span key={l} className="flex items-center gap-0.5 rounded-md bg-cream px-1.5 py-0.5 text-[9px] text-ink-muted"><Lock size={8} /> {l}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* 6 · prompt */}
            <section className={panel} aria-label="دستور متنی">
              <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><Pencil size={13} className="text-terracotta-deep" /> دستور به AI</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                rows={2}
                placeholder="مثلاً: مبل را عوض کن و رنگ دیوار کرم شود…"
                className="w-full resize-none rounded-xl border border-clay/50 bg-ivory-2 px-3 py-2.5 text-xs leading-6 text-ink outline-none transition focus:border-terracotta disabled:opacity-40"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q.label} onClick={() => applyQuickPrompt(q)} disabled={busy}
                    className="rounded-full border border-clay/50 bg-ivory-2 px-2.5 py-1 text-[10px] font-bold text-ink-muted transition hover:border-terracotta hover:text-terracotta-deep disabled:opacity-40">
                    {q.label}
                  </button>
                ))}
              </div>
            </section>

            {/* PRIMARY ACTION — always visible, always clear */}
            <div className="sticky bottom-3 z-10 space-y-2 rounded-2xl border border-clay/50 bg-cream/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
              <button onClick={generate} disabled={!canGenerate} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm font-black disabled:opacity-40">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {result ? "اعمال تغییر" : "طراحی کن"}
              </button>

              {/* credit cost — BEFORE generation */}
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="flex items-center gap-1 text-ink-muted">
                  <Coins size={12} className="text-gold" />
                  هزینه این تولید: <b className="text-gold">{toFa(cost)} اعتبار</b>
                </span>
                <span className="text-ink-muted">بعد از تولید: <b className="text-ink">{toFa(Math.max(0, balance - cost))}</b></span>
              </div>

              {/* insufficient credits — explanation + buy */}
              {insufficient && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-danger"><AlertTriangle size={12} /> اعتبار کافی نیست</p>
                  <p className="mt-0.5 text-[10px] leading-5 text-ink-muted">
                    این تولید {toFa(cost)} اعتبار لازم دارد و موجودی تو {toFa(balance)} است. با خرید اعتبار ادامه بده.
                  </p>
                  <ButtonLink href="/account/credits" size="sm" className="mt-2 w-full"><CreditCard size={13} /> خرید اعتبار</ButtonLink>
                </div>
              )}
              {!baseImage && <p className="text-center text-[10px] text-ink-muted">برای شروع، عکس اتاقت را آپلود کن</p>}
            </div>
          </div>

          {/* ============ RIGHT: canvas ============ */}
          <div className="min-w-0 space-y-3 lg:col-span-7">
            {/* premium loading — never blank, never frozen */}
            {busy && <AiPhaseLoader phase={phase} note={scope === "full" ? "بازطراحی کامل — تغییرات گسترده با اجازه‌ی تو." : "فقط عناصر خواسته‌شده تغییر می‌کنند؛ بقیه فضا قفل است."} />}

            {/* intent — confirmed BEFORE generating */}
            {!busy && (intent || understanding) && (
              <IntentCard analysis={intent} understanding={understanding} onToggleTarget={(el) => setTargets((ts) => ts.includes(el) ? ts.filter((x) => x !== el) : [...ts, el])} />
            )}

            {/* result */}
            {!busy && result && (
              <>
                <section className="rounded-2xl border border-clay/50 bg-cream p-3 shadow-[var(--shadow-soft)] sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-clay/30 pb-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink"><Wand2 size={14} className="text-terracotta-deep" /> نتیجه طراحی</h3>
                      {phase === "partial-success" && <Badge tone="gold">پیش‌نمایش — موتور واقعی متصل نیست</Badge>}
                      {phase === "success" && <Badge tone="success">تکمیل شد</Badge>}
                      {result.imageEngine && <span className="rounded-md bg-ivory-2 px-1.5 py-0.5 text-[9px] font-bold text-ink-muted" dir="ltr">engine: {result.imageEngine}</span>}
                    </div>
                    {/* view switcher */}
                    <div className="flex gap-0.5 rounded-lg border border-clay/40 bg-ivory-2 p-0.5">
                      {([["result", "نتیجه"], ["compare", "قبل / بعد"], ["regions", `نواحی (${toFa(result.result.regions?.length ?? 0)})`]] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setResultView(v)}
                          className={cn("rounded-md px-2.5 py-1 text-[10px] font-bold transition", resultView === v ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {resultView === "compare" && result.result.beforeImage ? (
                    <BeforeAfterSlider before={result.result.beforeImage} after={result.result.afterImage} />
                  ) : resultView === "regions" ? (
                    <OverlayRegionsView image={result.result.afterImage} regions={result.result.regions ?? []} />
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-clay/40"><img src={result.result.afterImage} alt="نتیجه طراحی" className="aspect-video w-full object-cover" /></div>
                  )}

                  {/* scope summary — what changed / what was preserved */}
                  <div className="mt-3 rounded-xl bg-ivory-2 p-2.5 text-[10px] leading-5 text-ink-muted">
                    <span className="font-bold text-terracotta-deep">تغییر کرد:</span> {result.instruction.targets.map((t) => ELEMENT_LABELS[t]).join("، ") || "—"}
                    {result.instruction.preserved.length > 0 && (
                      <span className="mt-0.5 block"><span className="font-bold text-sage-deep">حفظ شد:</span> {result.instruction.preserved.slice(0, 8).map((t) => ELEMENT_LABELS[t]).join("، ")}{result.instruction.preserved.length > 8 ? " و…" : ""}</span>
                    )}
                  </div>

                  {/* remaining credits — AFTER generation */}
                  <div className="mt-2.5 flex items-center justify-between rounded-xl border border-gold/25 bg-gold/5 px-3 py-2 text-[11px]">
                    <span className="flex items-center gap-1 text-ink-muted"><Coins size={12} className="text-gold" /> مصرف: <b className="text-gold">{toFa(result.creditsCost)} اعتبار</b></span>
                    <span className="text-ink-muted">اعتبار باقی‌مانده: <b className="text-ink">{toFa(balance)}</b></span>
                  </div>
                </section>

                {/* actions */}
                <section className="rounded-2xl border border-clay/50 bg-cream p-3 shadow-[var(--shadow-soft)]">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <button onClick={reEdit} className="flex flex-col items-center gap-1 rounded-xl border border-clay/40 bg-ivory-2 py-2.5 text-[10px] font-bold text-ink transition hover:border-terracotta hover:text-terracotta-deep">
                      <Pencil size={15} /> ویرایش دوباره
                    </button>
                    <button onClick={onDownload} className="flex flex-col items-center gap-1 rounded-xl border border-clay/40 bg-ivory-2 py-2.5 text-[10px] font-bold text-ink transition hover:border-terracotta hover:text-terracotta-deep">
                      <Download size={15} /> دانلود
                    </button>
                    <button onClick={onWishlist} className={cn("flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-bold transition", savedId && wl.designs.includes(savedId) ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 bg-ivory-2 text-ink hover:border-terracotta hover:text-terracotta-deep")}>
                      <Heart size={15} className={cn(savedId && wl.designs.includes(savedId) && "fill-current")} /> مجموعه من
                    </button>
                    <button onClick={onShare} className="flex flex-col items-center gap-1 rounded-xl border border-clay/40 bg-ivory-2 py-2.5 text-[10px] font-bold text-ink transition hover:border-terracotta hover:text-terracotta-deep">
                      <Share2 size={15} /> اشتراک
                    </button>
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Link href="/ai/history" className="flex items-center justify-center gap-1 rounded-xl border border-clay/40 bg-ivory-2 py-2 text-[10px] font-bold text-ink-muted transition hover:text-ink">
                      <History size={13} /> {savedId ? "در تاریخچه ذخیره شد — مشاهده" : "تاریخچه طراحی‌ها"}
                    </Link>
                    <button onClick={retry} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-clay/40 bg-ivory-2 py-2 text-[10px] font-bold text-ink-muted transition hover:text-ink disabled:opacity-40">
                      <RotateCcw size={13} /> تولید دوباره
                    </button>
                  </div>
                </section>

                {/* products used — future-ready (capability 16) */}
                <section className="rounded-2xl border border-clay/50 bg-cream p-3 shadow-[var(--shadow-soft)]">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-ink"><ShoppingBag size={13} className="text-terracotta-deep" /> محصولات استفاده‌شده در این طراحی</h3>
                  {(result.result.products?.length ?? 0) > 0 || (result.result.regions?.length ?? 0) > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {(result.result.products ?? []).map((p, i) => (
                          <span key={i} className="rounded-full border border-clay/40 bg-ivory-2 px-2 py-0.5 text-[10px] text-ink-muted">{p.label}</span>
                        ))}
                        {(result.result.regions ?? []).map((r) => (
                          <span key={r.id} className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{r.label}</span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-ink-muted">به‌زودی: هر عنصر به محصولات واقعی بازارگاه Homeino لینک می‌شود.</p>
                    </>
                  ) : (
                    <p className="text-[10px] leading-5 text-ink-muted">وقتی موتور واقعی تصویر (Orali) متصل شود، عناصر استفاده‌شده در طراحی اینجا فهرست و به محصولات فروشگاه لینک می‌شوند.</p>
                  )}
                </section>
              </>
            )}

            {/* error / no-result */}
            {!busy && (phase === "error" || phase === "no-result") && (
              <section className={cn("rounded-2xl border p-4", phase === "error" ? "border-danger/30 bg-danger/5" : "border-gold/40 bg-gold/5")}>
                <p className={cn("flex items-center gap-1.5 text-sm font-bold", phase === "error" ? "text-danger" : "text-gold")}>
                  <AlertTriangle size={16} /> {phase === "error" ? "خطا در تولید" : "نتیجه‌ای تولید نشد"}
                </p>
                <p className="mt-1 text-[11px] leading-6 text-ink-muted">{errorMsg}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={retry} className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-cream transition hover:bg-terracotta-deep">
                    <RefreshCw size={13} /> تلاش مجدد
                  </button>
                  {phase === "no-result" && (
                    <button onClick={() => { setPrompt(""); setIntent(null); setPhase("idle"); }} className="rounded-lg border border-clay/50 bg-cream px-4 py-2 text-xs font-bold text-ink-muted transition hover:text-ink">
                      بازنویسی دستور
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* idle empty state — one clear starting point, no tour */}
            {!busy && !result && phase !== "error" && phase !== "no-result" && baseImage && (
              <section className="rounded-2xl border border-clay/50 bg-cream p-6 shadow-[var(--shadow-soft)]">
                <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-clay/50 bg-ivory-2 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-cream"><Wand2 size={24} /></span>
                  <p className="mt-3 text-sm font-black text-ink">آماده‌ای؟ فقط «طراحی کن» را بزن</p>
                  <p className="mt-1 max-w-xs text-[11px] leading-6 text-ink-muted">
                    بگو چه چیزی تغییر کند — «مبل را عوض کن» فقط مبل را عوض می‌کند. ساختار اتاق، پنجره‌ها و پلان همیشه حفظ می‌شوند.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function AIDesignerPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[70vh] place-items-center bg-ivory"><Loader2 className="animate-spin text-ink-muted" /></div>}>
      <DesignerInner />
    </Suspense>
  );
}
