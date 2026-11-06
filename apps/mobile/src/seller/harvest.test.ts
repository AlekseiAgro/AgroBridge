import { AVAILABILITY } from '../catalog/categories';
import {
  formatHarvestDate,
  harvestDateInput,
  harvestDatesOrdered,
  parseHarvestDate,
  parseHarvestStatus,
  parseSeasonMonths,
  SEASON_MONTHS,
} from './harvest';

describe('harvest planning contract', () => {
  it('keeps the UTC calendar date and does not shift it to the previous local day', () => {
    expect(harvestDateInput('2026-10-02T00:00:00.000Z')).toBe('2026-10-02');
    expect(harvestDateInput('2026-01-01T00:00:00.000Z')).toBe('2026-01-01');
    expect(harvestDateInput('2026-10-02')).toBe('2026-10-02');
    const stored = harvestDateInput('2026-10-02T00:00:00.000Z');
    const shifted = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date('2026-10-02T00:00:00.000Z'),
    );
    const shown = formatHarvestDate(stored, 'en-US');
    expect(shown).toBe(
      new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(2026, 9, 2),
      ),
    );
    expect(shown).toContain('2');
    expect(shown).not.toBe(shifted === 'October 1, 2026' ? shifted : 'October 1, 2026');
  });

  it('accepts one date, both dates, and equal dates, and rejects an inverted range', () => {
    expect(parseHarvestDate('')).toBeNull();
    expect(parseHarvestDate('2026-06-01')).toBe('2026-06-01');
    expect(parseHarvestDate('2026-02-31')).toBe('invalid');
    expect(harvestDatesOrdered('2026-06-01', null)).toBe(true);
    expect(harvestDatesOrdered(null, '2026-09-30')).toBe(true);
    expect(harvestDatesOrdered('2026-06-01', '2026-06-01')).toBe(true);
    expect(harvestDatesOrdered('2026-10-03', '2026-10-02')).toBe(false);
  });

  it('keeps month numbers unique and sorted', () => {
    expect(parseSeasonMonths([])).toEqual([]);
    expect(parseSeasonMonths([6])).toEqual([6]);
    expect(parseSeasonMonths([9, 6, 7])).toEqual([6, 7, 9]);
    expect(parseSeasonMonths([...SEASON_MONTHS])).toEqual([...SEASON_MONTHS]);
    expect(parseSeasonMonths([1, 1])).toBe('invalid');
    expect(parseSeasonMonths([0])).toBe('invalid');
    expect(parseSeasonMonths([13])).toBe('invalid');
  });

  it('accepts only the harvest status codes', () => {
    for (const status of AVAILABILITY) {
      expect(parseHarvestStatus(status)).toBe(status);
    }
    expect(parseHarvestStatus(null)).toBeNull();
    expect(parseHarvestStatus('')).toBeNull();
    expect(parseHarvestStatus('ripe')).toBe('invalid');
    expect(parseHarvestStatus('Growing')).toBe('invalid');
  });
});
