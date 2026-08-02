import { isGeorgiaRegion } from '@agrobridge/shared';

export function formatRegionLabel(
  region: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!region) {
    return null;
  }
  if (isGeorgiaRegion(region)) {
    return t(`regions.${region}`);
  }
  return region;
}
