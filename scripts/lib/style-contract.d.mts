/**
 * Type declarations for scripts/lib/style-contract.mjs
 * (قرارداد نگارش انسانی هومینو — no-ai-slop + i-have-adhd، فارسی‌شده)
 */

export declare const WRITING_CONTRACT: string;

export declare const SLOP_HARD_FA: string[];
export declare const SLOP_HARD_EN: string[];
export declare const SLOP_SOFT_FA: string[];
export declare const SLOP_SOFT_EN: string[];
export declare const SLOP_HARD: string[];
export declare const SLOP_SOFT: string[];

export interface SlopHit {
  phrase: string;
  lang: "fa" | "en";
  tier: "hard" | "soft";
  index: number;
}

export interface SlopVerdict {
  clean: boolean;
  hard: SlopHit[];
  soft: SlopHit[];
}

export declare function slopVerdict(text: string): SlopVerdict;

export declare function buildSlopRetryHint(hits: SlopHit[]): string;
