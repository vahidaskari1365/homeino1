"use client";
// ============================================================
// کارت مدیریت Google AI (Gemini) — پنل ادمین هومینو.
// کلید فقط ماسک‌شده نمایش داده می‌شود؛ بعد از ذخیره، فیلد پاک می‌ماند.
// ذخیره → PUT /api/admin/ai/settings (رمزنگاری AES-256-GCM در DB)
// تست    → POST /api/admin/ai/test (ListModels — بدون مصرف توکن)
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { KeyRound, PlugZap, ShieldCheck, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";

interface RuntimeInfo { active: boolean; source: "db" | "env" | null; textModel: string; imageModel: string }
interface SavedInfo { hasKey: boolean; apiKeyMask: string | null; enabled: boolean; textModel: string | null; imageModel: string | null }
interface State {
  saved: SavedInfo | null;
  runtime: RuntimeInfo;
  defaults: { textModel: string; imageModel: string };
  hint?: string;
}
interface TestResult { ok: boolean; error?: string; modelsCount?: number; textModelReady?: boolean; imageModelReady?: boolean; keySource?: string; note?: string }

const SOURCE_LABEL: Record<string, string> = { db: "ذخیره در پنل (DB)", env: "متغیر محیطی (Vercel)" };

export function GeminiEngineCard() {
  const { toast } = useUi();
  const [state, setState] = useState<State | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [textModel, setTextModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [test, setTest] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/settings", { cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; data?: State };
      if (json.ok && json.data) {
        setState(json.data);
        setEnabled(json.data.saved?.enabled ?? true);
        setTextModel(json.data.saved?.textModel ?? "");
        setImageModel(json.data.saved?.imageModel ?? "");
      }
    } catch {
      toast("خواندن تنظیمات ناموفق بود");
    }
  }, [toast]);

  useEffect(() => {
    // defer — خواندن تنظیمات بعد از mount (بدون setState سنکرون در افکت)
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    setBusy("save");
    setTest(null);
    try {
      const body: Record<string, unknown> = { enabled };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (textModel.trim()) body.textModel = textModel.trim();
      if (imageModel.trim()) body.imageModel = imageModel.trim();
      const res = await fetch("/api/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
      if (json.ok) {
        toast("تنظیمات گوگل ذخیره شد");
        setApiKey("");
        await load();
      } else {
        toast(json.error?.message ?? "ذخیره ناموفق بود");
      }
    } catch {
      toast("ذخیره ناموفق بود");
    } finally {
      setBusy("");
    }
  };

  const runTest = async () => {
    setBusy("test");
    try {
      const res = await fetch("/api/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiKey.trim() ? { provider: "gemini", apiKey: apiKey.trim() } : { provider: "gemini" }),
      });
      const json = (await res.json()) as { ok: boolean; data?: TestResult };
      if (json.ok && json.data) {
        setTest(json.data);
        if (json.data.ok) toast("اتصال به گوگل برقرار است");
        else toast(json.data.error ?? "تست ناموفق بود");
      }
    } catch {
      toast("تست اتصال ناموفق بود");
    } finally {
      setBusy("");
    }
  };

  const runtime = state?.runtime;
  const sourceLabel = runtime?.source ? SOURCE_LABEL[runtime.source] : "تنظیم نشده";

  return (
    <div className="card-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-terracotta-deep" />
          <h2 className="font-display text-sm font-black text-ink">Google AI — Gemini (متن + عکس)</h2>
        </div>
        <div className="flex items-center gap-2">
          {runtime?.active ? <Badge tone="success">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}
          <Badge tone="dark">منبع: {sourceLabel}</Badge>
        </div>
      </div>

      <p className="text-xs leading-6 text-ink-muted">
        یک کلید رایگان از Google AI Studio کل این بخش را فعال می‌کند: توضیحات هوشمند محصولات، چت دستیار دکوراسیون،
        تحلیل قصد کاربر و تولید/ویرایش عکس با مدل Nano Banana. کلید رایگان را از{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold text-terracotta-deep underline">aistudio.google.com/apikey</a>{" "}
        بگیرید (دکمه «Create API key») و همین‌جا ذخیره کنید — نیازی به تغییر متغیرهای Vercel نیست.
      </p>

      {state?.saved?.apiKeyMask && (
        <div className="flex items-center gap-2 rounded-lg border border-clay/40 bg-ivory-2 px-3 py-2 text-xs text-ink">
          <ShieldCheck size={14} className="text-success" />
          کلید ذخیره‌شده: <span dir="ltr" className="font-mono">{state.saved.apiKeyMask}</span>
          <span className="text-ink-muted">(رمزنگاری‌شده در دیتابیس)</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-xs text-ink">
          کلید API (AIza…)
          <input
            type="password"
            dir="ltr"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={state?.saved?.apiKeyMask ?? "AIza…"}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-clay/60 bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-terracotta"
          />
        </label>
        <label className="block text-xs text-ink">
          مدل متن
          <input
            dir="ltr"
            value={textModel}
            onChange={(e) => setTextModel(e.target.value)}
            placeholder={state?.defaults.textModel}
            className="mt-1 w-full rounded-lg border border-clay/60 bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-terracotta"
          />
        </label>
        <label className="block text-xs text-ink">
          مدل عکس
          <input
            dir="ltr"
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value)}
            placeholder={state?.defaults.imageModel}
            className="mt-1 w-full rounded-lg border border-clay/60 bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-terracotta"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-terracotta" />
        موتور گوگل فعال باشد (غیرفعال کردن → تولید عکس با Pollinations رایگان ادامه می‌یابد)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={busy !== ""}
          className="flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-xs font-bold text-white hover:bg-terracotta-deep disabled:opacity-50"
        >
          <ShieldCheck size={14} /> {busy === "save" ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </button>
        <button
          onClick={runTest}
          disabled={busy !== ""}
          className="flex items-center gap-1.5 rounded-lg border border-clay/60 px-4 py-2 text-xs font-bold text-ink hover:bg-ivory-2 disabled:opacity-50"
        >
          {busy === "test" ? <RefreshCcw size={14} className="animate-spin" /> : <PlugZap size={14} />} تست اتصال
        </button>
      </div>

      {test && (
        <div className={`rounded-lg border px-3 py-2 text-xs leading-6 ${test.ok ? "border-success/40 bg-success/5 text-ink" : "border-warning/40 bg-warning/5 text-ink"}`}>
          {test.ok ? (
            <>
              اتصال برقرار است — {test.modelsCount} مدل در دسترس این کلید است · متن: {test.textModelReady ? "آماده" : "دیده نشد"} · عکس: {test.imageModelReady ? "آماده" : "دیده نشد"}
              {test.note ? ` — ${test.note}` : ""}
            </>
          ) : (
            test.error ?? "تست ناموفق بود"
          )}
        </div>
      )}
    </div>
  );
}
