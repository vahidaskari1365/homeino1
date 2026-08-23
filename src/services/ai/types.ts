import type { OverlayRegion } from "./orali/types";
import type { AiMode } from "../../types";

export interface GenerateDesignInput {
  mode: AiMode;
  prompt: string;
  style?: string;
  room?: string;
  color?: string;
  mood?: string;
  aspectRatio?: string;
  referenceImage?: string;
  productId?: string;
  /** Base64 PNG mask (white = region to edit) for precise inpainting. */
  mask?: string;
}

export interface GeneratedDesign {
  id: string;
  beforeImage?: string;
  afterImage: string;
  creditsUsed: number;
  products: { label: string; productId?: string }[];
  /** When true, the output is NOT a real AI-generated image — it's a
   *  development preview (original preserved or placeholder). The UI must
   *  show an honest "preview" badge, never fake a successful real edit. */
  preview?: boolean;
  /** Overlay metadata: the regions the visual engine actually changed.
   *  Empty when no real overlay engine ran — the UI must not fake boxes. */
  regions?: OverlayRegion[];
}

export interface ChatReplyInput {
  message: string;
  /** Page context: current URL, product name, etc. — lets the AI give relevant answers. */
  context?: string;
}

export interface ChatReply {
  content: string;
}

export interface DecorSuggestion {
  color: string;
  furniture: string[];
  lighting: string;
  rug: string;
  accessories: string[];
  layout: string;
}

export interface GuidedSuggestion {
  id: string;
  title: string;
  desc: string;
  impact: "low" | "medium" | "high";
  creditCost: number;
  category: string; // e.g. "rug", "lighting", "furniture"
  preview?: string;
}

export interface RoomArchitectureDetails {
  walls?: string;
  floor?: string;
  ceiling?: string;
  windows?: number | string;
  doors?: number | string;
  openings?: string[];
}

export interface RoomAnalysis {
  roomType: string;
  style: string;
  /** Estimated style with confidence score (e.g. likely_style = Scandinavian, confidence = 0.78) */
  likelyStyle?: {
    style: string;
    confidence: number;
  };
  palette: string[];
  mood: string;
  suggestions: string[];
  /** Guided design — AI strengths + opportunities + actionable suggestions */
  strengths: string[];
  opportunities: string[];
  guidedSuggestions: GuidedSuggestion[];
  /** Detailed spatial and design analysis (never invents facts; unknown if uncertain) */
  architecture?: RoomArchitectureDetails;
  lighting?: string;
  furniture?: string[];
  furnitureTypes?: string[];
  colors?: string[];
  materials?: string[];
  decor?: string[];
  composition?: string;
  spatialConstraints?: string[];
  emptySpaces?: string[];
  visualBalance?: string;
  functionalIssues?: string[];
  designOpportunities?: string[];
  confidence?: number;
}

export interface RecommendedProduct {
  productId: string;
  reason: string;
  score: number;
}

/**
 * The Provider contract. UI talks to `aiService`; the real implementation
 * (Gemini-ready) lives behind /api/ai. Swap providers freely — no UI changes.
 */
export interface AiProvider {
  generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign>;
  editImage(input: GenerateDesignInput): Promise<GeneratedDesign>;
  /** Precise inpainting: edit ONLY the masked region, preserve the rest of the image. */
  inpaint(input: GenerateDesignInput): Promise<GeneratedDesign>;
  analyzeRoom(input: GenerateDesignInput): Promise<RoomAnalysis>;
  recommendProducts(input: GenerateDesignInput): Promise<RecommendedProduct[]>;
  chat(input: ChatReplyInput): Promise<ChatReply>;
  suggestDecor(input: { room: string; style: string; budget?: string }): Promise<DecorSuggestion>;
}

export const AI_MODES: {
  id: AiMode;
  title: string;
  desc: string;
  cost: number;
}[] = [
  { id: "room-redesign", title: "بازطراحی اتاق", desc: "عکس اتاقت رو آپلود کن و سبک دلخواهت رو اعمال کن", cost: 5 },
  { id: "prompt-to-design", title: "طراحی از متن", desc: "فقط توصیف کن، ما برات طراحی می‌کنیم", cost: 5 },
  { id: "image-edit", title: "ویرایش عکس", desc: "مبل رو عوض کن، رنگ دیوار رو تغییر بده، فرش اضافه کن", cost: 3 },
  { id: "product-in-room", title: "محصول در اتاق", desc: "یک محصول Homeino رو در فضای خودت قرار بده", cost: 4 },
  { id: "decor-suggest", title: "پیشنهاد دکوراسیون", desc: "اطلاعات اتاق رو بده، پیشنهاد کامل بگیر", cost: 6 },
  { id: "full-concept", title: "کانسپت کامل", desc: "متراژ، سبک و بودجه → یک کانسپت طراحی کامل", cost: 8 },
];
