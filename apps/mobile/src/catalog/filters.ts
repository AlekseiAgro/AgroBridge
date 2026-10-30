/**
 * Category and harvest status stay single-valued.
 * Region is a list: no selection means no restriction, and several selections match any of them.
 * GET /products?region=kakheti&region=imereti is the API form. A single region=imereti still works.
 */
export const CATALOG_FILTER_CARDINALITY = {
  category: 'single',
  region: 'multiple',
  harvestStatus: 'single',
} as const;

export type CatalogFilters = {
  categoryId: string | null;
  regions: string[];
  harvestStatus: string | null;
  preorder: boolean;
  inSeason: boolean;
};

export function emptyCatalogFilters(): CatalogFilters {
  return {
    categoryId: null,
    regions: [],
    harvestStatus: null,
    preorder: false,
    inSeason: false,
  };
}

export function normalizeRegionSelection(value: string | readonly string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(trimmed);
  }
  return regions;
}

export function catalogFiltersFromRoute(params?: {
  categoryId?: string;
  region?: string;
  regions?: string[];
  harvestStatus?: string;
  preorder?: boolean;
  inSeason?: boolean;
}): CatalogFilters {
  return {
    categoryId: params?.categoryId || null,
    regions: normalizeRegionSelection([...(params?.regions ?? []), ...(params?.region ? [params.region] : [])]),
    harvestStatus: params?.harvestStatus || null,
    preorder: params?.preorder === true,
    inSeason: params?.inSeason === true,
  };
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.categoryId ? 1 : 0) +
    (filters.regions.length > 0 ? 1 : 0) +
    (filters.harvestStatus ? 1 : 0) +
    (filters.preorder ? 1 : 0) +
    (filters.inSeason ? 1 : 0)
  );
}

export function filterSummaryLabel(filtersLabel: string, count: number): string {
  return count > 0 ? `${filtersLabel} · ${count}` : filtersLabel;
}

export function regionFilterSummary(
  regions: readonly string[],
  labels: {
    any: string;
    single: (region: string) => string;
    many: (count: number) => string;
  },
): string {
  if (regions.length === 0) return labels.any;
  const only = regions[0];
  if (regions.length === 1 && only) return labels.single(only);
  return labels.many(regions.length);
}

export function toggleSingleFilter(
  filters: CatalogFilters,
  key: 'categoryId' | 'harvestStatus',
  value: string,
): CatalogFilters {
  return { ...filters, [key]: filters[key] === value ? null : value };
}

export function toggleRegion(filters: CatalogFilters, region: string): CatalogFilters {
  const regions = filters.regions.includes(region)
    ? filters.regions.filter((item) => item !== region)
    : [...filters.regions, region];
  return { ...filters, regions };
}

export function clearRegions(filters: CatalogFilters): CatalogFilters {
  return { ...filters, regions: [] };
}

export function setCatalogFlag(
  filters: CatalogFilters,
  key: 'preorder' | 'inSeason',
  value: boolean,
): CatalogFilters {
  return { ...filters, [key]: value };
}

export function catalogProductsInput(
  filters: CatalogFilters,
  extra: { query?: string | null; locale?: string | null } = {},
) {
  return {
    categoryId: filters.categoryId,
    query: extra.query,
    locale: extra.locale,
    region: filters.regions.length > 0 ? filters.regions : null,
    harvestStatus: filters.harvestStatus,
    preorder: filters.preorder,
    inSeason: filters.inSeason,
  };
}
