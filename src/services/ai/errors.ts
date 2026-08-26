// ============================================================
// HOMEINO AI — STANDARDIZED ERROR MODEL  (Phase 18)
//
// Every AI failure is normalized to one of these codes before it
// leaves the server. The user never sees a stack trace or a raw
// provider error — only a safe, short Persian message.
// ============================================================

export type AiErrorCode =
  | "PROVIDER_ERROR"        // provider down / 5xx / malformed provider response
  | "TIMEOUT"               // request exceeded the deadline
  | "RATE_LIMIT"            // provider or our own rate limit hit
  | "INVALID_REQUEST"       // malformed request from the client
  | "INVALID_SKU"           // SKU / product code not found in catalog
  | "CATEGORY_SKU_CONFLICT" // SKU category contradicts selected UI category
  | "CATALOG_UNAVAILABLE"   // Supabase / product catalog unreachable (production)
  | "INSUFFICIENT_CREDITS"  // server-side credit gate refused
  | "INVALID_AI_OUTPUT"     // model returned unusable output (after retries)
  | "IMAGE_PROCESSING_ERROR" // image decode / encode / storage failure
  | "DUPLICATE_REQUEST"     // identical generation already in flight
  | "INTERNAL";             // anything unexpected — never leak details

/** Safe, user-facing Persian messages per code. */
export const AI_ERROR_MESSAGE: Record<AiErrorCode, string> = {
  PROVIDER_ERROR: "موتور هوشمند در دسترس نیست — کمی بعد دوباره تلاش کن.",
  TIMEOUT: "پاسخ AI دیر شد — دوباره تلاش کن.",
  RATE_LIMIT: "تعداد درخواست‌ها زیاد است — کمی صبر کن.",
  INVALID_REQUEST: "درخواست نامعتبر است.",
  INVALID_SKU: "این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید.",
  CATEGORY_SKU_CONFLICT: "کد محصول واردشده با دسته‌بندی انتخابی مغایرت دارد.",
  CATALOG_UNAVAILABLE: "کاتالوگ محصولات موقتاً در دسترس نیست — کمی بعد دوباره تلاش کن.",
  INSUFFICIENT_CREDITS: "اعتبار کافی نیست.",
  INVALID_AI_OUTPUT: "نتیجه‌ی AI قابل قبول نبود — دوباره تلاش کن.",
  IMAGE_PROCESSING_ERROR: "پردازش تصویر ممکن نشد — تصویر دیگری امتحان کن.",
  DUPLICATE_REQUEST: "همین درخواست در حال اجراست — کمی صبر کن.",
  INTERNAL: "خطای سرور — کمی بعد دوباره تلاش کن.",
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  /** True when a bounded retry MAY succeed. */
  readonly retriable: boolean;
  readonly details?: unknown;

  constructor(code: AiErrorCode, message?: string, opts?: { status?: number; retriable?: boolean; details?: unknown; cause?: unknown }) {
    super(message ?? AI_ERROR_MESSAGE[code]);
    this.name = "AiError";
    this.code = code;
    this.status = opts?.status ?? statusFor(code);
    this.retriable = opts?.retriable ?? isRetriableCode(code);
    if (opts?.details !== undefined) this.details = opts.details;
    if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }

  static provider(message?: string, status?: number, details?: unknown) {
    return new AiError("PROVIDER_ERROR", message, { status: status ?? 502, retriable: true, details });
  }
  static timeout(message = "AI request timed out") {
    return new AiError("TIMEOUT", message, { status: 504, retriable: true });
  }
  static rateLimit(message?: string) {
    return new AiError("RATE_LIMIT", message, { status: 429, retriable: true });
  }
  static invalidRequest(message?: string) {
    return new AiError("INVALID_REQUEST", message, { status: 400, retriable: false });
  }
  static invalidSku(message?: string) {
    return new AiError("INVALID_SKU", message, { status: 400, retriable: false });
  }
  static categoryConflict(message?: string) {
    return new AiError("CATEGORY_SKU_CONFLICT", message, { status: 400, retriable: false });
  }
  static catalogUnavailable(message?: string, details?: unknown) {
    return new AiError("CATALOG_UNAVAILABLE", message, { status: 503, retriable: true, details });
  }
  static insufficientCredits(details?: unknown) {
    return new AiError("INSUFFICIENT_CREDITS", undefined, { status: 422, retriable: false, details });
  }
  static invalidOutput(message = "AI returned invalid output") {
    return new AiError("INVALID_AI_OUTPUT", message, { status: 502, retriable: false });
  }
  static imageProcessing(message?: string, details?: unknown) {
    return new AiError("IMAGE_PROCESSING_ERROR", message, { status: 422, retriable: false, details });
  }
  static duplicate(message?: string) {
    return new AiError("DUPLICATE_REQUEST", message, { status: 409, retriable: false });
  }
}

function statusFor(code: AiErrorCode): number {
  switch (code) {
    case "RATE_LIMIT": return 429;
    case "INVALID_REQUEST":
    case "INVALID_SKU":
    case "CATEGORY_SKU_CONFLICT": return 400;
    case "CATALOG_UNAVAILABLE": return 503;
    case "INSUFFICIENT_CREDITS": return 422;
    case "DUPLICATE_REQUEST": return 409;
    case "TIMEOUT": return 504;
    case "INVALID_AI_OUTPUT":
    case "PROVIDER_ERROR":
    case "IMAGE_PROCESSING_ERROR":
    case "INTERNAL":
    default: return 500;
  }
}

export function isRetriableCode(code: AiErrorCode): boolean {
  return code === "PROVIDER_ERROR" || code === "TIMEOUT" || code === "RATE_LIMIT" || code === "CATALOG_UNAVAILABLE";
}

/** Normalize ANY thrown value into an AiError (never throws). */
export function classifyAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  // Known internal error classes.
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: unknown })?.status;

  if (name === "AbortError" || /timeout|timed out|abort/i.test(message)) {
    return AiError.timeout(message);
  }
  if (typeof status === "number") {
    if (status === 429) return AiError.rateLimit(message);
    if (status >= 500) return AiError.provider(message, status);
    if (status === 422) return AiError.invalidRequest(message);
  }
  if (/rate.?limit|too many requests/i.test(message)) return AiError.rateLimit(message);
  if (/not configured|unavailable|failed|error|5\d\d/i.test(message)) return AiError.provider(message);
  if (/json|parse|invalid|schema/i.test(message)) return AiError.invalidOutput(message);
  if (/image|base64|decode|encode/i.test(message)) return AiError.imageProcessing(message);
  return new AiError("INTERNAL", undefined, { details: err instanceof Error ? err.message : undefined });
}

/** The ONLY error shape that ever reaches the client. */
export interface PublicAiError {
  code: AiErrorCode;
  message: string;
  requestId?: string;
}

export function toPublicAiError(err: unknown, requestId?: string): PublicAiError {
  const ai = classifyAiError(err);
  return {
    code: ai.code,
    message: AI_ERROR_MESSAGE[ai.code],
    ...(requestId ? { requestId } : {}),
  };
}
