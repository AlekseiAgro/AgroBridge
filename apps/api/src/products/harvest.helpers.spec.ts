import { normalizeSeasonMonths, isHarvestStatus } from '@agrobridge/shared';

describe('harvest shared helpers', () => {
  it('normalizes and sorts season months', () => {
    expect(normalizeSeasonMonths([3, 1, 3, '2', 99, 0])).toEqual([1, 2, 3]);
  });

  it('validates harvest statuses', () => {
    expect(isHarvestStatus('growing')).toBe(true);
    expect(isHarvestStatus('soldOut')).toBe(true);
    expect(isHarvestStatus('ripe')).toBe(false);
  });
});
