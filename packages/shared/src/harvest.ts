export const HARVEST_STATUSES = [
  'growing',
  'available',
  'limited',
  'soldOut',
] as const;
export type HarvestStatus = (typeof HARVEST_STATUSES)[number];

export function isHarvestStatus(value: string): value is HarvestStatus {
  return (HARVEST_STATUSES as readonly string[]).includes(value);
}

/** Calendar months 1–12 used for seasonal availability. */
export const SEASON_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type SeasonMonth = (typeof SEASON_MONTHS)[number];

export function isSeasonMonth(value: number): value is SeasonMonth {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

export function normalizeSeasonMonths(values: unknown): SeasonMonth[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<SeasonMonth>();
  for (const value of values) {
    const month = typeof value === 'number' ? value : Number(value);
    if (isSeasonMonth(month)) unique.add(month);
  }
  return [...unique].sort((a, b) => a - b);
}

export type ProductHarvest = {
  seasonMonths: SeasonMonth[];
  harvestStartAt: string | null;
  harvestEndAt: string | null;
  forecastQuantity: number | null;
  harvestStatus: HarvestStatus | null;
  preorderEnabled: boolean;
};

export type HarvestWatchStatus = {
  watching: boolean;
  productId: string;
};
