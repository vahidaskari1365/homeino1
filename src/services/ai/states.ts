// ============================================================
// AI STATES — the complete state machine of the AI Designer.
// Every phase the experience can be in, with Persian labels.
// The page must NEVER look empty or frozen during generation —
// busy states always render the premium phase loader.
// ============================================================

export type AiPhase =
  | "idle"            // nothing loaded yet
  | "uploading"       // reading/validating the room image
  | "analyzing"       // extracting space metadata
  | "understanding"   // LLM intent analysis (structured)
  | "generating"      // image engine running
  | "processing"      // validating + post-processing the result
  | "success"         // completed result
  | "partial-success" // result ready, but marked preview/degraded
  | "error"           // failed — recoverable
  | "retry"           // re-running after a failure
  | "no-result";      // engine returned nothing usable

export const AI_PHASE_LABEL: Record<AiPhase, string> = {
  idle: "آماده",
  uploading: "در حال بارگذاری تصویر",
  analyzing: "در حال تحلیل فضا",
  understanding: "در حال درک درخواست تو",
  generating: "در حال تولید طراحی",
  processing: "در حال پردازش نهایی",
  success: "طراحی آماده شد",
  "partial-success": "نتیجه آماده است (پیش‌نمایش)",
  error: "خطا در تولید",
  retry: "تلاش مجدد…",
  "no-result": "نتیجه‌ای تولید نشد",
};

export const BUSY_PHASES: readonly AiPhase[] = ["uploading", "analyzing", "understanding", "generating", "processing", "retry"];

export const isBusyPhase = (phase: AiPhase): boolean => BUSY_PHASES.includes(phase);

/** Ordered stepper shown inside the premium loader. */
export const PIPELINE_STEPS = [
  { key: "uploading", label: "دریافت تصویر" },
  { key: "analyzing", label: "تحلیل فضا" },
  { key: "understanding", label: "درک درخواست" },
  { key: "generating", label: "تولید طراحی" },
  { key: "processing", label: "پردازش نهایی" },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"];

/** Map a busy phase to its active stepper index. */
export function stepIndexForPhase(phase: AiPhase): number {
  switch (phase) {
    case "uploading": return 0;
    case "analyzing": return 1;
    case "understanding": return 2;
    case "generating": return 3;
    case "processing": return 4;
    default: return 0;
  }
}

/** Rotating tips — keeps the wait feel alive and premium. */
export const AI_WAIT_TIPS: string[] = [
  "ساختار اتاق، پنجره‌ها و پلان دقیقاً حفظ می‌شوند.",
  "فقط همان چیزی تغییر می‌کند که خودت خواسته‌ای.",
  "نورپردازی طبیعی و پرسپکتیو دوربین ثابت می‌ماند.",
  "می‌توانی بعد از تولید، نتیجه را دوباره ویرایش کنی.",
  "نتیجه در تاریخچه طراحی‌هایت ذخیره می‌شود.",
  "برای تغییر دقیق‌تر، دستور مشخص بنویس: «مبل را عوض کن».",
];
