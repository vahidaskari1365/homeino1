// ============================================================
// OpenAI-Compatible CHAT provider — SERVER-ONLY.
//
// Same env style as `llm/openaiCompatLlm` (works with FreeLLMAPI,
// OpenRouter, vLLM, OpenAI, …):
//
//   LLM_API_BASE_URL  e.g. https://api.freellmapi.com/v1
//   LLM_API_KEY
//   LLM_MODEL         e.g. glm-4.7-flash (default "auto")
//
// Every reply is GROUNDED: the model sees the top-6 REAL catalog products
// (name + exact price + sku) and may only reference those; after generation
// the reply is passed through the agents' outputGuard, which keeps only
// product cards that exist in the real catalog. Non-chat actions delegate to
// the mock provider (this is a chat-only addition to the provider chain).
// ============================================================
import type { AiProvider, ChatReply, ChatReplyInput } from "./types";
import { mockAiProvider } from "./mockAiService";
import { guardAgentOutput } from "@/services/agents/outputGuard";
import { listCatalog, type CatalogProduct } from "@/services/agents/catalog";

const BASE = () => (process.env.LLM_API_BASE_URL || "").replace(/\/+$/, "");
const KEY = () => process.env.LLM_API_KEY || "";
const MODEL = () => process.env.LLM_MODEL || "auto";

function systemPrompt(catalogLines: string): string {
  return [
    "تو دستیار هوشمند خرید و دکوراسیون Homeino هستی. به فارسی، کوتاه و حرفه‌ای پاسخ بده.",
    "کاتالوگ واقعی Homeino (فقط این محصولات واقعی هستند):",
    catalogLines,
    "قوانین:",
    "۱) فقط همین محصولات را پیشنهاد کن — هرگز محصول، شناسه، اسکیو یا قیمتی نساز.",
    "۲) اگر نام محصولی را می‌آوری، دقیقاً با همان نام و همان قیمتِ کاتالوگ بیاور.",
    "۳) اگر سؤال خارج از حوزهٔ خانه و دکوراسیون است، مؤدبانه بگو فقط در همین حوزه کمک می‌کنی.",
    "۴) اگر سؤال دربارهٔ قیمت و شرایط یک محصول خاص در صفحهٔ محصول است، از همان اطلاعاتِ داده‌شده پاسخ بده.",
  ].join("\n");
}

/** Deterministic top-6 spread over the real catalog (rating × reviews first). */
async function topRealProducts(limit = 6): Promise<CatalogProduct[]> {
  const rows = await listCatalog(500);
  const ranked = [...rows]
    .filter((p) => p.inStock !== false)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
  // Keep a broad mix of categories instead of 6 sofas.
  const picked: CatalogProduct[] = [];
  const seenCategories = new Set<string>();
  for (const p of ranked) {
    const key = p.subCategorySlug ?? p.categorySlug ?? p.id;
    if (picked.length >= limit) break;
    if (seenCategories.has(key) && picked.length >= 4) continue;
    seenCategories.add(key);
    picked.push(p);
  }
  return picked;
}

function toCatalogLines(rows: CatalogProduct[]): string {
  return rows.map((p, i) => `${i + 1}. ${p.name} — ${p.price.toLocaleString("fa-IR")} ${p.currency ?? "تومان"} (sku: ${p.sku ?? "-"})`).join("\n");
}

async function fetchChatCompletion(messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${BASE()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY()}` },
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0.4,
        max_tokens: 700,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`chat completions failed: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("chat completions returned no content");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function chat(input: ChatReplyInput): Promise<ChatReply> {
  const catalog = await topRealProducts(6);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(toCatalogLines(catalog)) },
  ];
  for (const turn of (input.history ?? []).slice(-8)) {
    messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: String(turn.content ?? "").slice(0, 600) });
  }
  const userParts = [input.context ? `زمینهٔ صفحه: ${input.context}` : "", `کاربر: ${input.message}`].filter(Boolean);
  messages.push({ role: "user", content: userParts.join("\n") });

  let content: string;
  try {
    content = await fetchChatCompletion(messages);
  } catch {
    // Degrade honestly: never show an error bubble when a mock can still help.
    const fallback = await mockAiProvider.chat(input);
    return fallback;
  }

  // ---- Grounding: only attach cards for catalog products the reply names. ----
  const mentioned = catalog.filter((p) => content.includes(p.name));
  const guarded = await guardAgentOutput({
    products: mentioned.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: p.currency ?? "تومان",
      image: p.images?.[0],
      url: `/products/${p.slug}`,
      storeName: p.storeName ?? undefined,
    })),
  });
  const safeProducts = Array.isArray(guarded.output.products) ? (guarded.output.products as ChatReply["products"]) : [];
  return { content, products: safeProducts };
}

/**
 * Chat-only OpenAI-compatible provider. Every other action delegates to the
 * mock provider so the resolver can stay single-provider for the whole app.
 */
export const openAiChatProvider: AiProvider = {
  generateDesign: (input) => mockAiProvider.generateDesign(input),
  editImage: (input) => mockAiProvider.editImage(input),
  inpaint: (input) => mockAiProvider.inpaint(input),
  analyzeRoom: (input) => mockAiProvider.analyzeRoom(input),
  recommendProducts: (input) => mockAiProvider.recommendProducts(input),
  suggestDecor: (input) => mockAiProvider.suggestDecor(input),
  chat,
};
