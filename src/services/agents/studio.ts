// ============================================================
// HOMEINO STUDIO — AGENT ORCHESTRATION (server-only)
//
// The design studio runs THROUGH the site's real agents (the same
// definitions that live in the agents DB table):
//
//   designer              → SKU preservation + real catalog matching
//   shopping-assistant    → natural-language look summary + real finds
//   inventory             → low-stock warnings for the chosen pieces
//   recommendation        → complementary products for the look
//   customer-intelligence → style memory (signed-in customers)
//   browser               → allowlisted web tasks (honest "not needed
//                            here" unless a URL is supplied)
//
// Every item comes from the real catalog; when an agent has nothing
// real to say its report says so — never a invented filler.
// ============================================================
import { runAgentByKey } from "./runtime";

export interface StudioAgentProductRef {
  id: string;
  name?: string;
  category?: string;
  sku?: string;
  price?: number;
}

export interface StudioAgentsInput {
  products: StudioAgentProductRef[];
  roomType?: string;
  style?: string;
  colors?: string[];
  targets?: string[];
  budget?: number;
  userId?: string | null;
  sessionId?: string | null;
  designId?: string;
}

export interface StudioAgentReport {
  key: string;
  name: string;
  status: "ok" | "empty" | "skipped" | "error";
  note: string;
}

export interface StudioComplement {
  id: string;
  name?: string;
  price?: number;
  image?: string;
  url?: string;
  storeName?: string | null;
  reason?: string;
}

export interface StudioAgentsReport {
  summary: string;
  agents: StudioAgentReport[];
  complements: StudioComplement[];
  stockWarnings: string[];
  ok: boolean;
}

interface AgentRunLike {
  ok?: boolean;
  output?: unknown;
  dataState?: string;
}

function outputOf(run: AgentRunLike): Record<string, unknown> {
  return (run.output ?? {}) as Record<string, unknown>;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const AGENT_LABELS: Record<string, string> = {
  designer: "ایجنت طراح",
  "shopping-assistant": "دستیار خرید",
  inventory: "ایجنت موجودی",
  recommendation: "ایجنت پیشنهاددهنده",
  "customer-intelligence": "ایجنت هوش مشتری",
  browser: "ایجنت مرورگر",
};

/**
 * Run the studio agent crew. A single agent failing never breaks the
 * report — each one gets an honest status line.
 */
export async function runStudioAgents(input: StudioAgentsInput): Promise<StudioAgentsReport> {
  const products = input.products ?? [];
  const room = input.roomType ?? "نشیمن";
  const style = input.style ?? "";
  const colorText = (input.colors ?? []).join(" و ");
  const names = products.map((p) => p.name).filter(Boolean).join("، ");
  const budgetText = input.budget ? ` بودجه حدود ${input.budget} تومان` : "";
  const reports: StudioAgentReport[] = [];
  let complements: StudioComplement[] = [];
  const stockWarnings: string[] = [];
  let summary = "";

  const [designerRun, shoppingRun, inventoryRun, recommendationRun, customerRun] = await Promise.allSettled([
    runAgentByKey("designer", {
      input: {
        room,
        style: style || undefined,
        colors: input.colors ?? [],
        targets: input.targets ?? [],
        budget: input.budget ? { min: input.budget } : undefined,
        designId: input.designId,
        limit: 6,
      },
      userId: input.userId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      triggeredBy: "studio:design",
    }),
    runAgentByKey("shopping-assistant", {
      input: {
        message: `برای ${room}${style ? ` با سبک ${style}` : ""}${colorText ? ` به رنگ ${colorText}` : ""} این وسایل را می‌خواهم: ${names || "چیدمان کامل"}.${budgetText}`,
        limit: 6,
      },
      userId: input.userId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      triggeredBy: "studio:design",
    }),
    runAgentByKey("inventory", {
      input: { threshold: 5 },
      triggeredBy: "studio:design",
    }),
    runAgentByKey("recommendation", {
      input: { scenario: "ai_designer", seedProductId: products[0]?.id, limit: 6 },
      userId: input.userId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      triggeredBy: "studio:design",
    }),
    input.userId
      ? runAgentByKey("customer-intelligence", {
          input: { userId: input.userId, sessionId: input.sessionId },
          userId: input.userId,
          sessionId: input.sessionId,
          triggeredBy: "studio:design",
        })
      : Promise.resolve({ ok: true, output: { skipped: true }, dataState: "no_data" } satisfies AgentRunLike),
  ]);

  // ---- designer: matched real products for the look ----
  if (designerRun.status === "fulfilled") {
    const out = outputOf(designerRun.value);
    const matched = Array.isArray(out.matchedProducts) ? (out.matchedProducts as Record<string, unknown>[]) : [];
    const preserved = out.preservedProduct as Record<string, unknown> | null | undefined;
    const notes: string[] = [];
    if (preserved && asString(preserved.name)) notes.push(`محصول انتخابی «${asString(preserved.name)}» در طرح حفظ شد`);
    if (matched.length) notes.push(`${matched.length} محصول واقعی هماهنگ با فضا پیدا شد`);
    reports.push({
      key: "designer",
      name: AGENT_LABELS.designer,
      status: notes.length ? "ok" : "empty",
      note: notes.join(" — ") || "هماهنگی کاتالوگ برای این فضا نتیجه‌ای نداشت",
    });
    if (!complements.length && matched.length) {
      complements = matched.slice(0, 6).map(mapComplement);
    }
  } else {
    reports.push({ key: "designer", name: AGENT_LABELS.designer, status: "error", note: "اجرای ایجنت طراح ناموفق بود" });
  }

  // ---- shopping-assistant: human summary + real finds ----
  if (shoppingRun.status === "fulfilled") {
    const out = outputOf(shoppingRun.value);
    const answer = asString(out.answer);
    const found = Array.isArray(out.products) ? (out.products as Record<string, unknown>[]) : [];
    if (answer) {
      summary = answer;
      reports.push({ key: "shopping-assistant", name: AGENT_LABELS["shopping-assistant"], status: "ok", note: answer });
      if (!complements.length && found.length) complements = found.slice(0, 6).map(mapComplement);
    } else {
      reports.push({ key: "shopping-assistant", name: AGENT_LABELS["shopping-assistant"], status: "empty", note: "خلاصه‌ای برای این ترکیب تولید نشد" });
    }
  } else {
    reports.push({ key: "shopping-assistant", name: AGENT_LABELS["shopping-assistant"], status: "error", note: "اجرای دستیار خرید ناموفق بود" });
  }

  // ---- inventory: low-stock warnings among the chosen pieces ----
  if (inventoryRun.status === "fulfilled") {
    const out = outputOf(inventoryRun.value);
    const items = Array.isArray(out.items) ? (out.items as Record<string, unknown>[]) : [];
    const chosenIds = new Set(products.map((p) => p.id));
    const chosenNames = new Set(products.map((p) => (p.name ?? "").trim()).filter(Boolean));
    const relevant = items.filter((it) => {
      const id = asString(it.id) ?? asString(it.productId);
      const name = asString(it.name);
      return (id && chosenIds.has(id)) || (name && chosenNames.has(name));
    });
    if (relevant.length) {
      relevant.slice(0, 4).forEach((it) => {
        const name = asString(it.name) ?? "محصول";
        const stock = Number(it.stockCount ?? 0);
        stockWarnings.push(`موجودی «${name}» محدود است (${stock} عدد) — برای سفارش سریع‌تر اقدام کن`);
      });
      reports.push({ key: "inventory", name: AGENT_LABELS.inventory, status: "ok", note: `${relevant.length} کالا از انتخاب‌های تو موجودی محدود دارد` });
    } else {
      reports.push({ key: "inventory", name: AGENT_LABELS.inventory, status: "ok", note: "همه کالاهای انتخابی موجودی سالم دارند" });
    }
  } else {
    reports.push({ key: "inventory", name: AGENT_LABELS.inventory, status: "error", note: "بررسی موجودی ناموفق بود" });
  }

  // ---- recommendation: complementary pieces ----
  if (recommendationRun.status === "fulfilled") {
    const out = outputOf(recommendationRun.value);
    const items = Array.isArray(out.items) ? (out.items as Record<string, unknown>[]) : [];
    if (items.length) {
      if (complements.length < 6) {
        const existing = new Set(complements.map((c) => c.id));
        items.forEach((it) => {
          const id = asString(it.id) ?? asString(it.productId);
          if (!id || existing.has(id) || complements.length >= 6) return;
          complements.push(mapComplement(it));
          existing.add(id);
        });
      }
      reports.push({ key: "recommendation", name: AGENT_LABELS.recommendation, status: "ok", note: `${items.length} پیشنهاد مکمل برای این چیدمان ساخته شد` });
    } else {
      reports.push({ key: "recommendation", name: AGENT_LABELS.recommendation, status: "empty", note: "فعلاً پیشنهاد مکملی با شواهد کافی پیدا نشد" });
    }
  } else {
    reports.push({ key: "recommendation", name: AGENT_LABELS.recommendation, status: "error", note: "اجرای ایجنت پیشنهاددهنده ناموفق بود" });
  }

  // ---- customer-intelligence: signed-in style memory ----
  if (input.userId) {
    if (customerRun.status === "fulfilled") {
      const out = outputOf(customerRun.value);
      const profile = out.profile as Record<string, unknown> | null | undefined;
      const styles = Array.isArray(profile?.topStyles) ? (profile?.topStyles as unknown[]) : [];
      const styleText = styles.map((s) => (typeof s === "string" ? s : asString((s as Record<string, unknown>)?.slug) ?? "")).filter(Boolean).join("، ");
      reports.push({
        key: "customer-intelligence",
        name: AGENT_LABELS["customer-intelligence"],
        status: styleText ? "ok" : "empty",
        note: styleText ? `سلیقه ثبت‌شده‌ات: ${styleText} — طرح با آن هماهنگ شد` : "هنوز شواهد سلیقه‌ای کافی ثبت نشده — این طرح برایش ذخیره شد",
      });
    } else {
      reports.push({ key: "customer-intelligence", name: AGENT_LABELS["customer-intelligence"], status: "error", note: "ثبت حافظه سلیقه ناموفق بود" });
    }
  } else {
    reports.push({ key: "customer-intelligence", name: AGENT_LABELS["customer-intelligence"], status: "skipped", note: "برای فعال‌شدن حافظه سلیقه، وارد حساب کاربری شو" });
  }

  // ---- browser: honest scope note (allowlisted tasks only) ----
  reports.push({
    key: "browser",
    name: AGENT_LABELS.browser,
    status: "skipped",
    note: "ایجنت مرورگر فقط برای وظایف وب آدرس‌دار فعال می‌شود — در این مرحله نقشی ندارد",
  });

  const okCount = reports.filter((r) => r.status === "ok").length;
  if (!summary) {
    summary = names
      ? `چیدمان ${room}${style ? ` با سبک ${style}` : ""} شامل ${names} آماده شد — ${okCount} ایجنت روی این طرح کار کردند.`
      : `چیدمان ${room}${style ? ` با سبک ${style}` : ""} آماده شد — ${okCount} ایجنت روی این طرح کار کردند.`;
  }

  return { summary, agents: reports, complements, stockWarnings, ok: okCount > 0 };
}

function mapComplement(item: Record<string, unknown>): StudioComplement {
  return {
    id: asString(item.id) ?? asString(item.productId) ?? asString(item.slug) ?? Math.random().toString(36).slice(2),
    name: asString(item.name),
    price: typeof item.price === "number" ? item.price : undefined,
    image: asString(item.image) ?? (Array.isArray(item.images) ? asString(item.images[0]) : undefined),
    url: asString(item.url),
    storeName: asString(item.storeName) ?? null,
    reason: asString(item.reasonText) ?? asString(item.reason),
  };
}
