export type ProductMarketInsight = {
  productId: string;
  summary: string;
  highlights: string[];
  generatedAt: string;
  /** Stage-1 generator; replaceable with a live market/LLM provider later. */
  source: 'heuristic';
  opportunity: MarketOpportunity;
};

export const MARKET_OPPORTUNITY_TIERS = [
  'excellent',
  'good',
  'fair',
  'watch',
] as const;
export type MarketOpportunityTier = (typeof MARKET_OPPORTUNITY_TIERS)[number];

export type MarketOpportunity = {
  tier: MarketOpportunityTier;
  markets: string[];
  priceDeltaPercent: number;
  weeksToSeason: number | null;
  limitedSupply: boolean;
  highDemand: boolean;
  priceRiseLikely: boolean;
};

const DEMAND_MARKETS: Record<string, string[]> = {
  fruits: ['Germany', 'Poland', 'Netherlands'],
  berries: ['Germany', 'Netherlands', 'UAE'],
  vegetables: ['Poland', 'Romania', 'Czechia'],
  nuts: ['Germany', 'Italy', 'France'],
  wine: ['Germany', 'Poland', 'UK'],
  honey: ['Germany', 'France', 'Japan'],
  dairy: ['Armenia', 'Azerbaijan', 'Israel'],
  mineralWater: ['UAE', 'Kazakhstan', 'Poland'],
  spices: ['Germany', 'Netherlands', 'UK'],
  tea: ['Germany', 'Poland', 'UK'],
  bayLeaf: ['Germany', 'Italy', 'Spain'],
  essentialOils: ['France', 'Germany', 'UAE'],
  organic: ['Germany', 'Switzerland', 'Scandinavia'],
  other: ['Germany', 'Poland', 'UAE'],
};

export type MarketOpportunityInput = {
  id: string;
  category?: string | null;
  harvestStartAt?: string | Date | null;
  harvestStatus?: string | null;
  preorderEnabled?: boolean;
  currentStock?: number | null;
  maxQuantity?: number | null;
  exportMarkets?: string[];
};

function stablePercent(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

function weeksUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return null;
  const diffMs = value.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

/** Deterministic catalog opportunity signal from listing fields. */
export function evaluateMarketOpportunity(
  input: MarketOpportunityInput,
): MarketOpportunity {
  const category = input.category ?? 'other';
  const markets =
    input.exportMarkets && input.exportMarkets.length > 0
      ? input.exportMarkets.slice(0, 2)
      : (DEMAND_MARKETS[category] ?? DEMAND_MARKETS.other).slice(0, 2);

  const weeksToSeason = weeksUntil(input.harvestStartAt);
  const priceDeltaPercent = stablePercent(input.id, 4, 9);

  const limitedSupply =
    input.harvestStatus === 'limited' ||
    input.harvestStatus === 'soldOut' ||
    (input.currentStock != null &&
      input.maxQuantity != null &&
      input.currentStock > 0 &&
      input.currentStock <= input.maxQuantity * 0.35);

  const highDemand =
    markets.length >= 2 ||
    category === 'fruits' ||
    category === 'berries' ||
    category === 'nuts' ||
    category === 'wine' ||
    category === 'organic';

  const priceRiseLikely =
    (weeksToSeason != null && weeksToSeason > 0 && weeksToSeason <= 4) ||
    Boolean(input.preorderEnabled) ||
    input.harvestStatus === 'growing';

  let score = 0;
  if (highDemand) score += 2;
  if (limitedSupply) score += 2;
  if (priceRiseLikely) score += 2;
  if (input.preorderEnabled) score += 1;
  if (input.harvestStatus === 'available' && highDemand) score += 1;

  const tier: MarketOpportunityTier =
    score >= 5 ? 'excellent' : score >= 3 ? 'good' : score >= 2 ? 'fair' : 'watch';

  return {
    tier,
    markets,
    priceDeltaPercent,
    weeksToSeason,
    limitedSupply,
    highDemand,
    priceRiseLikely,
  };
}
