// ============================================================
// HOMEINO — INSTAGRAM AGENT HANDLER (MANUS · CONNECT-ONLY)
//
// مالک ۲۰۲۶-۰۹-۲۴: «یک ایجنت هم برای اینستاگرام درست کن که فعلاً
// کاری نکنه فقط وصل بشه — وقتی وصل شد بهم خبر بده.»
//
// اینستاگرام پروژه در اپ Manus (manus.im) با connect_type=instagram
// وصل شده است؛ این هندلر فقط **اتصال سمت سرورِ هومینو** به همان
// Manus API را بررسی می‌کند:
//   GET {MANUS_API_BASE_URL}/v1/tasks?limit=1   با Authorization: Bearer
//
// قانون «فعلاً کاری نکنه»:
//   • هیچ ابزاری صدا زده نمی‌شود (tools: [])
//   • هیچ LLMای صدا زده نمی‌شود
//   • هیچ نوشتنی در دیتابیس/شبکهٔ اجتماعی انجام نمی‌شود
//   • فقط یک GET فقط-خواندنی برای سنجش اتصال
//
// متغیرهای محیطی (Vercel → Settings → Environment Variables):
//   MANUS_API_KEY        کلید API منوس (open.manus.ai)
//   MANUS_API_BASE_URL   پیش‌فرض https://api.manus.ai
//   INSTAGRAM_AI_API_KEY نام جایگزین کلید (alias)
//
// خروجی همیشه صادقانه است (status یکی از):
//   connected | invalid_key | not_configured | unreachable | network_error
// ============================================================
import type { AgentHandler } from "./types";

const DEFAULT_BASE = "https://api.manus.ai";

export interface InstagramConnection {
  provider: "manus";
  baseUrl: string;
  status: "connected" | "invalid_key" | "not_configured" | "unreachable" | "network_error";
  httpStatus: number | null;
  message: string;
  serverDetail?: string;
  checkedAt: string;
}

export const runInstagramAgent: AgentHandler = async (_input, ctx) => {
  const key = (process.env.MANUS_API_KEY || process.env.INSTAGRAM_AI_API_KEY || "").trim();
  const base = (process.env.MANUS_API_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, "");
  const checkedAt = new Date().toISOString();

  let conn: InstagramConnection;

  if (!key) {
    conn = {
      provider: "manus",
      baseUrl: base,
      status: "not_configured",
      httpStatus: null,
      message:
        "کلید MANUS_API_KEY تنظیم نشده است. ایجنت ساخته شد و منتظر کلید است — کلید را در Vercel (Environment Variables) اضافه کنید یا برای اتصال آزمایشی به ادمین بدهید.",
      checkedAt,
    };
  } else {
    try {
      const res = await fetch(`${base}/v1/tasks?limit=1`, {
        headers: { accept: "application/json", authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        let taskCount: number | null = null;
        try {
          const body = (await res.json()) as { data?: unknown[]; tasks?: unknown[] } | null;
          const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.tasks) ? body.tasks : null;
          if (list) taskCount = list.length;
        } catch {
          /* body parse optional — connectivity already proven */
        }
        conn = {
          provider: "manus",
          baseUrl: base,
          status: "connected",
          httpStatus: res.status,
          message: taskCount === null
            ? "اتصال به Manus API برقرار است — کلید معتبر تأیید شد."
            : `اتصال به Manus API برقرار است — کلید معتبر تأیید شد (دریافت ${taskCount} آیتم نمونه).`,
          checkedAt,
        };
      } else {
        const detail = await res.text().catch(() => "");
        let serverDetail = detail.slice(0, 300);
        try {
          serverDetail = String((JSON.parse(detail) as { message?: string }).message ?? detail).slice(0, 300);
        } catch {
          /* keep raw text */
        }
        const invalid = res.status === 401 || res.status === 403;
        conn = {
          provider: "manus",
          baseUrl: base,
          status: invalid ? "invalid_key" : "unreachable",
          httpStatus: res.status,
          message: invalid
            ? "اتصال برقرار شد ولی Manus کلید را رد کرد — کلید ناقص/خراب است. یک کلید تازه از open.manus.ai بسازید."
            : `Manus پاسخ غیرمنتظره داد (HTTP ${res.status}) — بعداً تلاش کنید.`,
          serverDetail: serverDetail || undefined,
          checkedAt,
        };
      }
    } catch (err) {
      conn = {
        provider: "manus",
        baseUrl: base,
        status: "network_error",
        httpStatus: null,
        message: "اتصال شبکه‌ای به Manus برقرار نشد (timeout/DNS).",
        serverDetail: err instanceof Error ? err.message.slice(0, 200) : undefined,
        checkedAt,
      };
    }
  }

  ctx.log(`instagram connect-check: ${conn.status}`, { httpStatus: conn.httpStatus, base: conn.baseUrl });

  return {
    output: { connection: conn },
    dataState: conn.status === "connected" ? "ok" : conn.status === "not_configured" ? "no_data" : "degraded",
  };
};
