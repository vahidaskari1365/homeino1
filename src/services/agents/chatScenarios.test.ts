// ============================================================
// PHASE 2 — grounded chat scenario suite (no keys, no database).
//
// Mirrors the AIPanel flow exactly:
//   1. agentChat (routeIntent) first — real products + output-guarded answers
//   2. when the turn is advice / refusal / out-of-domain → the agent declines
//      with intent=general_chat and the panel falls back to the chat provider
//      (mock here, OpenAI-compatible when LLM_API_* keys are configured).
//
// Set AI_SCENARIO_OUT=reports/phase2-chat-scenarios.txt to persist a
// transcript (used by the final Phase-5 report).
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { routeIntent } from "./orchestrator";
import { mockAiProvider } from "@/services/ai/mockAiService";
import { ensureSeeded } from "./store";

interface Turn {
  role: "user" | "assistant";
  content: string;
  products?: unknown[];
}

interface TurnResult {
  turn: string;
  source: "agent" | "chat";
  content: string;
  products: unknown[];
  intent?: string;
  routedTo?: string;
  dataState?: string;
  agentIntent?: string;
  agentMessage?: string;
}

let transcript: string[] = [];
const OUT = process.env.AI_SCENARIO_OUT;

beforeAll(async () => {
  await ensureSeeded();
});

async function chatTurn(message: string, opts: { context?: string; history?: Turn[]; sessionId?: string } = {}): Promise<TurnResult> {
  const agent = await routeIntent({
    message,
    context: opts.context,
    history: opts.history?.map((h) => ({ role: h.role, content: h.content })),
    sessionId: opts.sessionId,
  });
  const agentText = (agent.message ?? "").trim();
  const agentProducts = Array.isArray(agent.products) ? agent.products : [];
  const agentUsable = agent.ok && agentText.length > 0 && agent.intent !== "general_chat";

  if (agentUsable) {
    const line: TurnResult = {
      turn: message,
      source: "agent",
      intent: agent.intent,
      routedTo: agent.routedTo,
      dataState: agent.dataState,
      content: agentText,
      products: agentProducts.map((p) => ({
        id: (p as { id?: string }).id,
        name: (p as { name?: string }).name,
        price: (p as { price?: number }).price,
        url: (p as { url?: string }).url,
      })),
    };
    transcript.push(`USER: ${message}\nROUTE: ${JSON.stringify(line, null, 1)}`);
    return line;
  }

  const chat = await mockAiProvider.chat({ message, context: opts.context, history: opts.history?.map((h) => ({ role: h.role, content: h.content })) });
  const content = (chat?.content ?? "").trim();
  const line: TurnResult = {
    turn: message,
    source: "chat",
    agentIntent: agent.intent,
    agentMessage: agentText,
    content,
    products: chat?.products ?? [],
  };
  transcript.push(`USER: ${message}\nROUTE: ${JSON.stringify(line, null, 1)}`);
  return line;
}

function saveTranscript() {
  if (!OUT) return;
  const file = path.resolve(OUT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, transcript.join("\n\n") + "\n", "utf8");
}

describe("grounded chat — ten fixed scenarios (no key, no DB)", () => {
  it("1) modern armchair/sofa under 20M → real products within budget", async () => {
    const r = await chatTurn("یه مبل راحتی مدرن می‌خوام، زیر ۲۰ میلیون");
    expect(r.source).toBe("agent");
    expect(r.content).toBeTruthy();
    expect((r.products as { price?: number }[]).length).toBeGreaterThan(0);
    expect((r.products as { price?: number }[]).every((p) => Number(p.price) <= 20_000_000)).toBe(true);
  });

  it("2) living-room palette advice → helpful Persian answer (chat fallback)", async () => {
    const r = await chatTurn("برای پذیرایی کوچیکم چه رنگی بهتره؟");
    expect(r.source).toBe("chat");
    expect(r.content).toMatch(/رنگ/);
    expect(r.content.length).toBeGreaterThan(30);
  });

  it("3) japandi vs scandinavian comparison → grounded advice naming real products", async () => {
    const r = await chatTurn("فرق سبک ژاپندی و اسکاندیناوی چیه؟");
    expect(r.content).toMatch(/ژاپندی/);
    expect(r.content).toMatch(/اسکاندیناوی/);
    expect(r.content).toMatch(/تومان/);
  });

  it("4) PDP price/conditions → agent SKU lookup of the real context product", async () => {
    const r = await chatTurn("قیمت و شرایط خرید این محصول چطوره؟", {
      context: "محصول: کاناپه هلیم ۳ نفره (id: p1، sku: SOF-1024)",
    });
    expect(r.source).toBe("agent");
    expect(r.content).toContain("SOF-1024");
    const product = (r.products as { name?: string; price?: number }[])[0];
    expect(product?.name).toContain("هلیم");
    expect(product?.price).toBe(48_500_000);
  });

  it("5) weather question → polite refusal (no hallucination)", async () => {
    const r = await chatTurn("فردا هوا چطوره؟ بارون میاد؟");
    expect(r.source).toBe("chat");
    expect(r.content).toMatch(/دکوراسیون|خانه|بپرس/);
  });

  it("6) wooden coffee table near sofa → real wooden coffee-table products", async () => {
    const r = await chatTurn("یه میز عسلی چوبی می‌خوام کنار مبل بذارم");
    expect(r.source).toBe("agent");
    expect((r.products as { name?: string }[]).length).toBeGreaterThan(0);
    const names = (r.products as { name?: string }[]).map((p) => p.name ?? "");
    expect(names.some((n) => /میز|عسلی|جلو مبلی/.test(n))).toBe(true);
  });

  it("7) Arabic ي/ك + ZWNJ normalization → parsed as real Persian query", async () => {
    const r = await chatTurn("مي‌خوام يک ميز جلو مبلي چوبي براي پذيرايي پيدا کنم");
    expect(r.source).toBe("agent");
    const names = (r.products as { name?: string }[]).map((p) => p.name ?? "");
    expect(names.some((n) => /میز|جلو مبلی/.test(n))).toBe(true);
  });

  it("8) «ارزون‌ترش داری؟» follow-up → previous budget lowered via history", async () => {
    const first = await chatTurn("یه مبل راحتی مدرن می‌خوام زیر ۵۰ میلیون", { sessionId: "s8" });
    expect(first.source).toBe("agent");
    const history: Turn[] = [
      { role: "user", content: "یه مبل راحتی مدرن می‌خوام زیر ۵۰ میلیون" },
      { role: "assistant", content: first.content },
    ];
    const second = await chatTurn("ارزون‌ترش داری؟", { sessionId: "s8", history });
    expect(second.source).toBe("agent");
    expect((second.products as { price?: number }[]).length).toBeGreaterThan(0);
    const secondPrices = (second.products as { price?: number }[]).map((p) => Number(p.price));
    const firstPrices = (first.products as { price?: number }[]).map((p) => Number(p.price));
    expect(Math.min(...secondPrices)).toBeLessThanOrEqual(Math.max(...firstPrices));
  });

  it("9) bedroom design request → routes to designer without AGENT_NOT_FOUND", async () => {
    const r = await chatTurn("اتاق خوابم رو به سبک ژاپندی طراحی کن");
    expect(r.source).toBe("agent");
    expect(r.routedTo).toBe("designer");
    expect(r.content).toBeTruthy();
  });

  it("10) empty + emoji-only → safe, never an error", async () => {
    const empty = await chatTurn("   ");
    expect(empty.content).toBeTruthy();
    expect(empty.content).not.toMatch(/خطا/i);
    const emoji = await chatTurn("😊");
    expect(emoji.content).toBeTruthy();
    expect(emoji.content).not.toMatch(/خطا/i);
  });
});

afterAll(() => saveTranscript());
