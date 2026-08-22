import { ApiError } from "@/lib/api/errors";

/**
 * Server-side AI provider abstractions.
 * Keys are NEVER in NEXT_PUBLIC_* — they live in server-only env vars and are
 * read here at runtime. Swapping an LLM/image provider never touches the UI or
 * the database.
 */

// ---------------------------------------------------------------
// LLM — structured intent
// ---------------------------------------------------------------
export interface LlmIntent {
  intent: string;
  target?: string;
  requestedChanges?: string[];
  preservedElements?: string[];
  style?: string | null;
  colors?: string[];
  confidence?: number;
}

export interface LlmProvider {
  readonly name: string;
  /** Return a SHORT structured intent, never a long prose response. */
  classifyIntent(prompt: string, context?: string): Promise<LlmIntent>;
}

const openaiStyle = "You extract a tiny structured JSON object describing a room-edit request.";

export class OpenAiCompatLlm implements LlmProvider {
  readonly name = "openai-compat";
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.LLM_API_BASE_URL ?? "";
    this.apiKey = process.env.LLM_API_KEY ?? "";
    this.model = process.env.LLM_MODEL ?? "glm-4.7-flash";
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("LLM_API_BASE_URL and LLM_API_KEY are required (server-side only)");
    }
  }

  async classifyIntent(prompt: string, context?: string): Promise<LlmIntent> {
    const sys = `${openaiStyle}\nReturn ONLY a compact JSON object like {"intent":"modify_object","target":"sofa","requestedChanges":[],"preservedElements":[],"style":null,"colors":[],"confidence":0.95}. Do not add prose.`;
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: context ? `${prompt}\n\nContext: ${context}` : prompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new ApiError("PROVIDER_ERROR", `LLM provider error ${res.status}`, 502);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(extractJson(content)) as LlmIntent;
    } catch {
      return { intent: "full_redesign", confidence: 0.6 } as LlmIntent;
    }
  }
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : "{}";
}

// ---------------------------------------------------------------
// Image editing — Orali provider
// ---------------------------------------------------------------
export interface EditImageInput {
  image: string; // URL or data
  prompt: string;
  intent: LlmIntent;
  mask?: string;
}

export interface EditImageOutput {
  resultUrl: string;
  overlay?: {
    mask?: string;
    boundingBox?: number[];
    segmentation?: unknown;
    targetObject?: string;
    originalRegion?: number[];
    generatedRegion?: number[];
  };
}

export interface ImageEditingProvider {
  readonly name: string;
  edit(input: EditImageInput): Promise<EditImageOutput>;
}

export class OraliProvider implements ImageEditingProvider {
  readonly name = "orali";
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.ORALI_API_BASE_URL ?? "";
    this.apiKey = process.env.ORALI_API_KEY ?? "";
    this.model = process.env.ORALI_MODEL ?? "orali-room-v1";
  }

  async edit(input: EditImageInput): Promise<EditImageOutput> {
    if (!this.baseUrl || !this.apiKey) {
      throw new ApiError("PROVIDER_ERROR", "Orali not configured (server-side env)", 502);
    }
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/edit`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        image: input.image,
        prompt: input.prompt,
        target: input.intent.target,
        preserved_elements: input.intent.preservedElements,
        mask: input.mask,
      }),
    });
    if (!res.ok) throw new ApiError("PROVIDER_ERROR", `Orali error ${res.status}`, 502);
    const json = (await res.json()) as {
      result_url?: string;
      overlay?: EditImageOutput["overlay"];
    };
    return { resultUrl: json.result_url ?? "", overlay: json.overlay };
  }
}

export class MockImageProvider implements ImageEditingProvider {
  readonly name = "mock-image";
  async edit(input: EditImageInput): Promise<EditImageOutput> {
    // honest dev-only fallback: keeps the original, no fake edit, no fake overlay
    return { resultUrl: input.image.replace(/^data:image\/\w+;base64,/, "") || input.image };
  }
}

// ---------------------------------------------------------------
// Registry / factory
// ---------------------------------------------------------------
export function llmProvider(): LlmProvider {
  return new OpenAiCompatLlm();
}

export function imageProvider(): ImageEditingProvider {
  return process.env.ORALI_API_KEY ? new OraliProvider() : new MockImageProvider();
}
