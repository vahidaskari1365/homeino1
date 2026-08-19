/**
 * Orali visual / overlay generation client.
 * Architecture is real: original + generated + overlay metadata.
 * Swap ORALI_API_URL / ORALI_API_KEY without UI changes.
 */

export interface OverlayRegion {
  id: string;
  label: string;
  /** normalized 0–1 box */
  x: number;
  y: number;
  w: number;
  h: number;
  editable: boolean;
}

export interface OverlayMetadata {
  version: 1;
  regions: OverlayRegion[];
  preservedArchitecture: boolean;
  provider: "orali" | "mock";
}

export interface OraliGenerateInput {
  originalImage: string;
  instruction: string;
  intentJson: unknown;
  mask?: string;
}

export interface OraliGenerateResult {
  generatedImage: string;
  overlay: OverlayMetadata;
  preview: boolean;
}

export interface OraliClient {
  generate(input: OraliGenerateInput): Promise<OraliGenerateResult>;
}

export function emptyOverlay(provider: OverlayMetadata["provider"] = "mock"): OverlayMetadata {
  return { version: 1, regions: [], preservedArchitecture: true, provider };
}

export const oraliClient: OraliClient = {
  async generate(input) {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "orali", payload: input }),
    });
    if (!res.ok) throw new Error("Orali unavailable");
    return res.json();
  },
};
