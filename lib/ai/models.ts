/**
 * Model registry + pricing for the AI layer.
 *
 * Agents pick a model by *semantic tier* ("fast" | "smart" | "max"), never by id,
 * so swapping the underlying model is a one-line change here. Pricing drives the
 * cost ledger and spend caps (see lib/ai/cost.ts).
 *
 * Prices are GBP **pence per million tokens** (to match invoices.amount_due,
 * which is also pence/GBP). They are ESTIMATES for budgeting — keep them roughly
 * current; exact billing always comes from the provider. Override per deployment
 * with ANTHROPIC_MODEL_{FAST,SMART,MAX} if you want different routing.
 */

export type AiTier = "fast" | "smart" | "max";

export interface ModelInfo {
  /** Anthropic model id sent in the API request. */
  id: string;
  /** GBP pence per 1,000,000 input tokens (estimate). */
  inputPerMTok: number;
  /** GBP pence per 1,000,000 output tokens (estimate). */
  outputPerMTok: number;
}

/** Defaults chosen for the agency workload; override via env (see below). */
const DEFAULTS: Record<AiTier, ModelInfo> = {
  // Cheap + fast: classification, scoring, extraction (Discovery/QA scoring).
  fast: { id: "claude-haiku-4-5-20251001", inputPerMTok: 64, outputPerMTok: 320 },
  // Balanced generative work: copy, Design DNA, outreach, proposals.
  smart: { id: "claude-sonnet-4-6", inputPerMTok: 240, outputPerMTok: 1200 },
  // Highest quality for the hardest generation when a job warrants it.
  max: { id: "claude-opus-4-8", inputPerMTok: 1200, outputPerMTok: 6000 },
};

function envModel(tier: AiTier): ModelInfo {
  const override = process.env[`ANTHROPIC_MODEL_${tier.toUpperCase()}`];
  const base = DEFAULTS[tier];
  return override ? { ...base, id: override } : base;
}

const REGISTRY: Record<AiTier, ModelInfo> = {
  fast: envModel("fast"),
  smart: envModel("smart"),
  max: envModel("max"),
};

/** Resolve a model id + pricing for a semantic tier. */
export function modelFor(tier: AiTier): ModelInfo {
  return REGISTRY[tier];
}

/** Look up pricing by raw model id (the API echoes the id it actually used). */
export function modelInfoById(id: string): ModelInfo | undefined {
  return Object.values(REGISTRY).find((m) => m.id === id);
}

/** Cost of a call in whole pence (rounded up so we never undercount a cap). */
export function computeCostPence(modelId: string, inputTokens: number, outputTokens: number): number {
  const info = modelInfoById(modelId) ?? REGISTRY.smart;
  const pence =
    (inputTokens / 1_000_000) * info.inputPerMTok +
    (outputTokens / 1_000_000) * info.outputPerMTok;
  return Math.ceil(pence);
}
