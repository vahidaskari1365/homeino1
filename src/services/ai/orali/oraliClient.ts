// ============================================================
// Orali HTTP Client — SERVER-ONLY. Never imported by a client
// bundle; resolved exclusively inside the AI pipeline.
//
// Env:
//   ORALI_API_BASE_URL   e.g. https://api.orali.com
//   ORALI_API_KEY
//   ORALI_MODEL          optional model override
//
// ADAPTER POINT: when the final Orali OpenAPI spec is published,
// adjust `buildEditPayload` / `parseEditResponse` in this ONE
// file — nothing else in the app changes.
// ============================================================
import type {
  OraliClient, OraliEditRequest, OraliEditResult, OverlayRegion,
} from "./types";
import { OraliNotConfiguredError, OraliRequestError } from "./types";

const BASE_URL = () => (process.env.ORALI_API_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = () => process.env.ORALI_API_KEY || "";
const MODEL = () => process.env.ORALI_MODEL || "orali-room-v1";

export const isOraliConfigured = (): boolean => Boolean(BASE_URL() && API_KEY());

/** Map our normalized request to the Orali edit endpoint payload. */
function buildEditPayload(req: OraliEditRequest): Record<string, unknown> {
  const b64 = req.image.replace(/^data:image\/\w+;base64,/, "");
  return {
    model: MODEL(),
    image: b64,
    prompt: req.instruction,
    ...(req.mask ? { mask: req.mask.replace(/^data:image\/\w+;base64,/, "") } : {}),
    preserve_structure: req.preserveArchitecture,
    ...(req.protectedElements?.length ? { protected_elements: req.protectedElements } : {}),
    ...(req.targetRegion ? { target_region: req.targetRegion } : {}),
    ...(req.style ? { style: req.style } : {}),
    ...(req.colors?.length ? { palette: req.colors } : {}),
    strength: req.strength ?? 0.65,
    response_format: "b64_json",
    metadata: { overlay_regions: true },
  };
}

/** Parse the Orali response into our normalized contract. */
function parseEditResponse(data: Record<string, unknown>, latencyMs: number): OraliEditResult {
  const imageField = (data.image ?? data.output ?? data.result) as Record<string, unknown> | string | undefined;
  let image = "";
  if (typeof imageField === "string") image = imageField;
  else if (imageField && typeof imageField === "object") {
    const o = imageField as Record<string, unknown>;
    const b64 = o.b64_json ?? o.b64 ?? o.data;
    const url = o.url;
    if (typeof b64 === "string" && b64) image = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
    else if (typeof url === "string") image = url;
  }
  if (!image) throw new OraliRequestError("ORALI_EMPTY_IMAGE");

  const rawRegions = (data.regions ?? data.overlay ?? (data.metadata as Record<string, unknown> | undefined)?.regions) as unknown[] | undefined;
  const regions: OverlayRegion[] = Array.isArray(rawRegions)
    ? rawRegions
        .map((r, i): OverlayRegion | null => {
          if (typeof r !== "object" || r === null) return null;
          const o = r as Record<string, unknown>;
          const box = (o.box ?? o.bbox ?? o.region) as Record<string, unknown> | undefined;
          if (!box) return null;
          const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
          const x = num(box.x), y = num(box.y), w = num(box.w ?? box.width), h = num(box.h ?? box.height);
          if (x === null || y === null || w === null || h === null) return null;
          return {
            id: typeof o.id === "string" ? o.id : `orali-r${i}`,
            label: typeof o.label === "string" ? o.label : "ناحیه تغییر",
            element: typeof o.element === "string" ? o.element : undefined,
            box: { x, y, w, h },
            mask: typeof o.mask === "string" ? o.mask : undefined,
            opacity: num(o.opacity) ?? 0.25,
            status: o.status === "failed" ? "failed" : "applied",
          };
        })
        .filter((r): r is OverlayRegion => r !== null)
    : [];

  return { image, regions, model: typeof data.model === "string" ? data.model : MODEL(), latencyMs };
}

export const oraliClient: OraliClient = {
  name: "orali",
  configured: isOraliConfigured(),

  async generateEdit(req: OraliEditRequest): Promise<OraliEditResult> {
    if (!isOraliConfigured()) throw new OraliNotConfiguredError();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // image edits can be slow
    const started = Date.now();
    try {
      const res = await fetch(`${BASE_URL()}/v1/images/edits`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY()}`,
        },
        body: JSON.stringify(buildEditPayload(req)),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new OraliRequestError(`ORALI_HTTP_${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`, res.status);
      }
      const data = (await res.json()) as Record<string, unknown>;
      return parseEditResponse(data, Date.now() - started);
    } catch (err) {
      if (err instanceof OraliRequestError || err instanceof OraliNotConfiguredError) throw err;
      if (err instanceof Error && err.name === "AbortError") throw new OraliRequestError("ORALI_TIMEOUT");
      throw new OraliRequestError(err instanceof Error ? `ORALI_FAILED: ${err.message}` : "ORALI_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },
};
