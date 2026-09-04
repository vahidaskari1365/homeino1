// ============================================================
// HOMEINO — LLM GATEWAY (provider-agnostic)
//
// One facade for every model call the orchestrator makes. The active provider
// is resolved from the environment (and can be pinned per agent through
// `agent.config.provider`), so swapping models never touches the core:
//
//   1. dify          DIFY_API_BASE_URL + DIFY_API_KEY        (agent/chat app)
//   2. langflow      LANGFLOW_BASE_URL + LANGFLOW_API_KEY + LANGFLOW_FLOW_ID
//   3. openai-compat LLM_API_BASE_URL + LLM_API_KEY          (current project LLM)
//   4. ollama        OLLAMA_BASE_URL                         (local open-source models)
//   5. heuristic     built-in deterministic engine           (always available)
//
// The gateway NEVER throws: a provider failure degrades to the heuristic engine
// and the result is flagged `degraded` so callers can stay honest.
//
// Embeddings follow the same pattern (Ollama /api/embed → OpenAI-compatible
// /embeddings → deterministic local lexical embedder `homeino-lexical-v1`).
// ============================================================

export type LlmProviderName = "dify" | "langflow" | "openai-compat" | "ollama" | "heuristic";

export interface LlmCompletionRequest {
  system?: string;
  prompt: string;
  /** Ask for a JSON object answer. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  /** Pin a provider (must be configured, otherwise resolution falls through). */
  provider?: LlmProviderName;
  agentKey?: string;
  timeoutMs?: number;
}

export interface LlmCompletionResult {
  text: string;
  provider: LlmProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Integer micro-units. Heuristic/local = 0. */
  costMicro: number;
  /** True when the requested provider failed and we degraded. */
  degraded: boolean;
}

export interface LlmStatusEntry {
  provider: LlmProviderName;
  label: string;
  configured: boolean;
  model?: string;
  baseUrl?: string;
  missing?: string[];
}

// ---- env accessors (server-only) ----
const env = {
  difyBase: () => (process.env.DIFY_API_BASE_URL ?? "https://api.dify.ai/v1").replace(/\/+$/, ""),
  difyKey: () => process.env.DIFY_API_KEY ?? "",
  difyChatApp: () => process.env.DIFY_CHAT_APP_ID ?? "",
  langflowBase: () => (process.env.LANGFLOW_BASE_URL ?? "").replace(/\/+$/, ""),
  langflowKey: () => process.env.LANGFLOW_API_KEY ?? "",
  langflowFlow: () => process.env.LANGFLOW_FLOW_ID ?? "",
  compatBase: () => (process.env.LLM_API_BASE_URL ?? "").replace(/\/+$/, ""),
  compatKey: () => process.env.LLM_API_KEY ?? "",
  compatModel: () => process.env.LLM_MODEL ?? "auto",
  ollamaBase: () => (process.env.OLLAMA_BASE_URL ?? "").replace(/\/+$/, ""),
  ollamaModel: () => process.env.OLLAMA_MODEL ?? "llama3.1",
  pinned: () => (process.env.HOMEINO_LLM_PROVIDER ?? "") as LlmProviderName | "",
  embedModel: () => process.env.EMBEDDING_MODEL ?? process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
};

/** Micro-cost per 1K tokens — overridable with HOMEINO_LLM_COST_MICRO_PER_1K. */
function costPer1kTokens(provider: LlmProviderName): number {
  const override = Number(process.env.HOMEINO_LLM_COST_MICRO_PER_1K ?? 0);
  if (override > 0) return override;
  switch (provider) {
    case "ollama":
    case "heuristic":
      return 0; // local compute — no per-token bill
    case "dify":
    case "langflow":
      return 120;
    default:
      return 200;
  }
}

function estimateTokens(text: string): number {
  // Rough but stable: ~4 chars per token for latin, ~2 for Persian script.
  const persian = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const other = text.length - persian;
  return Math.max(1, Math.round(persian / 2 + other / 4));
}

export function estimateCostMicro(provider: LlmProviderName, tokensIn: number, tokensOut: number): number {
  const rate = costPer1kTokens(provider);
  return Math.round(((tokensIn + tokensOut * 1.4) / 1000) * rate);
}

export function llmStatus(): LlmStatusEntry[] {
  const entries: LlmStatusEntry[] = [
    {
      provider: "dify",
      label: "Dify (Workflow/Agent Platform)",
      configured: Boolean(env.difyKey()),
      baseUrl: env.difyBase(),
      model: env.difyChatApp() || undefined,
      missing: env.difyKey() ? [] : ["DIFY_API_KEY"],
    },
    {
      provider: "langflow",
      label: "Langflow (Flow runner)",
      configured: Boolean(env.langflowBase() && env.langflowKey() && env.langflowFlow()),
      baseUrl: env.langflowBase() || undefined,
      model: env.langflowFlow() || undefined,
      missing: [
        ...(env.langflowBase() ? [] : ["LANGFLOW_BASE_URL"]),
        ...(env.langflowKey() ? [] : ["LANGFLOW_API_KEY"]),
        ...(env.langflowFlow() ? [] : ["LANGFLOW_FLOW_ID"]),
      ],
    },
    {
      provider: "openai-compat",
      label: "OpenAI-compatible endpoint (LLM فعلی پروژه)",
      configured: Boolean(env.compatBase() && env.compatKey()),
      baseUrl: env.compatBase() || undefined,
      model: env.compatModel(),
      missing: [...(env.compatBase() ? [] : ["LLM_API_BASE_URL"]), ...(env.compatKey() ? [] : ["LLM_API_KEY"])],
    },
    {
      provider: "ollama",
      label: "Ollama (مدل‌های Open Source محلی)",
      configured: Boolean(env.ollamaBase()),
      baseUrl: env.ollamaBase() || undefined,
      model: env.ollamaModel(),
      missing: env.ollamaBase() ? [] : ["OLLAMA_BASE_URL"],
    },
    { provider: "heuristic", label: "موتور قطعی داخلی Homeino", configured: true },
  ];
  return entries;
}

function resolutionOrder(pin?: LlmProviderName): LlmProviderName[] {
  const all: LlmProviderName[] = ["dify", "langflow", "openai-compat", "ollama", "heuristic"];
  const configured = all.filter((p) => llmStatus().find((s) => s.provider === p)?.configured);
  const pinned = pin ?? (env.pinned() || undefined);
  if (pinned && configured.includes(pinned)) {
    return [pinned, ...configured.filter((p) => p !== pinned), "heuristic"];
  }
  return [...configured, "heuristic"];
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// Provider calls
// ------------------------------------------------------------
async function callOpenAiCompat(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
  const model = req.model ?? env.compatModel();
  const payload = (await postJson(
    `${env.compatBase()}/chat/completions`,
    {
      model,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? 400,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ],
    },
    { Authorization: `Bearer ${env.compatKey()}` },
    req.timeoutMs ?? 15_000,
  )) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("empty completion");
  const tokensIn = payload.usage?.prompt_tokens ?? estimateTokens(req.prompt + (req.system ?? ""));
  const tokensOut = payload.usage?.completion_tokens ?? estimateTokens(text);
  return { text, provider: "openai-compat", model, tokensIn, tokensOut, costMicro: estimateCostMicro("openai-compat", tokensIn, tokensOut), degraded: false };
}

async function callOllama(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
  const model = req.model ?? env.ollamaModel();
  const payload = (await postJson(
    `${env.ollamaBase()}/api/chat`,
    {
      model,
      stream: false,
      ...(req.json ? { format: "json" } : {}),
      options: { temperature: req.temperature ?? 0.2, num_predict: req.maxTokens ?? 400 },
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ],
    },
    {},
    req.timeoutMs ?? 30_000,
  )) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number; model?: string };
  const text = payload.message?.content ?? "";
  if (!text) throw new Error("empty completion");
  const tokensIn = payload.prompt_eval_count ?? estimateTokens(req.prompt);
  const tokensOut = payload.eval_count ?? estimateTokens(text);
  return { text, provider: "ollama", model: payload.model ?? model, tokensIn, tokensOut, costMicro: 0, degraded: false };
}

/** Dify chat-messages (blocking) — the app-level API key stays server-side. */
async function callDify(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
  const payload = (await postJson(
    `${env.difyBase()}/chat-messages`,
    {
      inputs: {},
      query: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
      response_mode: "blocking",
      user: req.agentKey ? `agent:${req.agentKey}` : "homeino-orchestrator",
    },
    { Authorization: `Bearer ${env.difyKey()}` },
    req.timeoutMs ?? 25_000,
  )) as { answer?: string; metadata?: { usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }; model_id?: string } };
  const text = payload.answer ?? "";
  if (!text) throw new Error("empty answer");
  const tokensIn = payload.metadata?.usage?.prompt_tokens ?? estimateTokens(req.prompt);
  const tokensOut = payload.metadata?.usage?.completion_tokens ?? estimateTokens(text);
  return {
    text,
    provider: "dify",
    model: payload.metadata?.model_id ?? env.difyChatApp() ?? "dify-app",
    tokensIn,
    tokensOut,
    costMicro: estimateCostMicro("dify", tokensIn, tokensOut),
    degraded: false,
  };
}

/** Langflow flow run (non-streaming). */
async function callLangflow(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
  const payload = (await postJson(
    `${env.langflowBase()}/api/v1/run/${env.langflowFlow()}?stream=false`,
    {
      input_value: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
      input_type: "text",
      output_type: "text",
      tweaks: {},
    },
    { "x-api-key": env.langflowKey() },
    req.timeoutMs ?? 30_000,
  )) as { outputs?: { results?: { outputs?: { results?: { text?: string }[] }[] }[] }[] };
  const text = payload.outputs?.[0]?.results?.[0]?.outputs?.[0]?.results?.[0]?.text ?? "";
  if (!text) throw new Error("empty flow output");
  const tokensIn = estimateTokens(req.prompt);
  const tokensOut = estimateTokens(text);
  return {
    text,
    provider: "langflow",
    model: env.langflowFlow(),
    tokensIn,
    tokensOut,
    costMicro: estimateCostMicro("langflow", tokensIn, tokensOut),
    degraded: false,
  };
}

/**
 * Deterministic built-in engine. It answers only what can be derived from the
 * request itself — never inventing catalog facts. Used for intent extraction
 * and as the final fallback.
 */
function callHeuristic(req: LlmCompletionRequest): LlmCompletionResult {
  const text = req.json ? "{}" : "";
  const tokensIn = estimateTokens(req.prompt);
  return { text, provider: "heuristic", model: "homeino-heuristic-v1", tokensIn, tokensOut: 0, costMicro: 0, degraded: true };
}

const CALLERS: Record<LlmProviderName, (req: LlmCompletionRequest) => Promise<LlmCompletionResult>> = {
  dify: callDify,
  langflow: callLangflow,
  "openai-compat": callOpenAiCompat,
  ollama: callOllama,
  heuristic: async (req) => callHeuristic(req),
};

/** Never throws — degrades to the deterministic engine. */
export async function complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
  const order = resolutionOrder(req.provider);
  let lastError: Error | null = null;
  for (const provider of order) {
    try {
      const result = await CALLERS[provider](req);
      if (provider !== "heuristic") return result;
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[llm] provider ${provider} failed:`, (error as Error).message);
    }
  }
  const fallback = callHeuristic(req);
  return { ...fallback, degraded: true, text: fallback.text || (lastError ? "" : "") };
}

export interface JsonCompletionResult<T> extends LlmCompletionResult {
  data: T | null;
  parseError?: string;
}

/** Complete + parse JSON, with one bounded corrective retry. */
export async function completeJson<T>(req: LlmCompletionRequest, hint?: string): Promise<JsonCompletionResult<T>> {
  const first = await complete({ ...req, json: true });
  const parsed = tryParseJson<T>(first.text);
  if (parsed.ok) return { ...first, data: parsed.value };
  if (first.provider === "heuristic") return { ...first, data: null, parseError: parsed.error };
  const retry = await complete({
    ...req,
    json: true,
    prompt: `${req.prompt}\n\n${hint ?? "پاسخ قبلی JSON معتبر نبود. فقط یک شیء JSON معتبر برگردان، بدون هیچ توضیح اضافی."}`,
  });
  const second = tryParseJson<T>(retry.text);
  return { ...retry, data: second.ok ? second.value : null, parseError: second.ok ? undefined : second.error };
}

export function tryParseJson<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  if (!text) return { ok: false, error: "empty response" };
  const direct = text.trim();
  try {
    return { ok: true, value: JSON.parse(direct) as T };
  } catch {
    /* fall through to extraction */
  }
  const match = direct.match(/[\{\[][^\0]*[\}\]]/);
  if (match) {
    try {
      return { ok: true, value: JSON.parse(match[0]) as T };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
  return { ok: false, error: "no JSON payload found" };
}

// ------------------------------------------------------------
// Embeddings — pgvector-ready, deterministic local fallback
// ------------------------------------------------------------
export const LOCAL_EMBED_MODEL = "homeino-lexical-v1";
export const LOCAL_EMBED_DIMS = 256;

export interface EmbeddingResult {
  vectors: number[][];
  provider: LlmProviderName | "local-lexical";
  model: string;
  dims: number;
}

/** Deterministic hashed bag-of-words embedder (normalized). Real text in,
 *  real vector out — used when no embedding model is configured. */
export function localEmbed(text: string, dims = LOCAL_EMBED_DIMS): number[] {
  const vector = new Array<number>(dims).fill(0);
  const tokens = normalizeText(text).split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dims;
    vector[index] += 1;
  }
  // character bigrams give Persian morphology a little signal
  const compact = normalizeText(text).replace(/\s+/g, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const bigram = compact.slice(i, i + 2);
    let hash = 5381;
    for (let j = 0; j < bigram.length; j++) hash = ((hash << 5) + hash + bigram.charCodeAt(j)) | 0;
    vector[Math.abs(hash) % dims] += 0.35;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

export function normalizeText(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[\u200c\u200f]/g, " ")
    .replace(/[ً-ٟ]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embed(texts: string[], opts: { provider?: LlmProviderName; model?: string } = {}): Promise<EmbeddingResult> {
  const clean = texts.map((t) => String(t ?? "").slice(0, 4000));
  if (!clean.length) return { vectors: [], provider: "local-lexical", model: LOCAL_EMBED_MODEL, dims: LOCAL_EMBED_DIMS };

  // Ollama /api/embed
  if ((!opts.provider || opts.provider === "ollama") && env.ollamaBase()) {
    try {
      const payload = (await postJson(
        `${env.ollamaBase()}/api/embed`,
        { model: opts.model ?? env.embedModel(), input: clean },
        {},
        30_000,
      )) as { embeddings?: number[][] };
      if (payload.embeddings?.length === clean.length) {
        return { vectors: payload.embeddings, provider: "ollama", model: opts.model ?? env.embedModel(), dims: payload.embeddings[0].length };
      }
    } catch (error) {
      console.warn("[llm] ollama embeddings failed:", (error as Error).message);
    }
  }

  // OpenAI-compatible /embeddings
  if ((!opts.provider || opts.provider === "openai-compat") && env.compatBase() && env.compatKey()) {
    try {
      const payload = (await postJson(
        `${env.compatBase()}/embeddings`,
        { model: opts.model ?? process.env.EMBEDDING_MODEL ?? "text-embedding-3-small", input: clean },
        { Authorization: `Bearer ${env.compatKey()}` },
        20_000,
      )) as { data?: { embedding: number[] }[] };
      if (payload.data?.length === clean.length) {
        return {
          vectors: payload.data.map((d) => d.embedding),
          provider: "openai-compat",
          model: opts.model ?? "text-embedding-3-small",
          dims: payload.data[0].embedding.length,
        };
      }
    } catch (error) {
      console.warn("[llm] openai-compat embeddings failed:", (error as Error).message);
    }
  }

  return { vectors: clean.map((t) => localEmbed(t)), provider: "local-lexical", model: LOCAL_EMBED_MODEL, dims: LOCAL_EMBED_DIMS };
}
