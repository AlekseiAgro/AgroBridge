import { AVAILABILITY, type Availability } from '../catalog/categories';

/** Matches `CreateProductDto` forecastQuantity `@Max(99_999_999)`. */
export const FORECAST_QUANTITY_MAX = 99_999_999;

export const SEASON_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type SeasonMonth = (typeof SEASON_MONTHS)[number];

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Date-only `YYYY-MM-DD`, matching the web date input.
 * An API ISO timestamp contributes its UTC calendar date, not the device-local day.
 */
export function harvestDateInput(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match || !isCalendarDate(match[1])) {
    return '';
  }
  return match[1];
}

/** Empty is allowed. A value must already be a calendar date, not an ISO timestamp. */
export function parseHarvestDate(raw: string): string | null | 'invalid' {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  return isCalendarDate(text) ? text : 'invalid';
}

export function harvestDatesOrdered(start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return true;
  }
  return start <= end;
}

export function calendarParts(value: string): { year: number; month: number; day: number } | null {
  if (!isCalendarDate(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

export function calendarDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Monday-first cells for the calendar grid. Leading blanks are null. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const blanks: (number | null)[] = Array.from({ length: lead }, () => null);
  return [...blanks, ...Array.from({ length: count }, (_, index) => index + 1)];
}

export function formatHarvestDate(value: string, locale: string): string {
  const parts = calendarParts(value);
  if (!parts) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(parts.year, parts.month - 1, parts.day),
  );
}

/** Duplicates and values outside 1–12 are invalid. The API does not drop them. */
export function parseSeasonMonths(values: readonly number[]): number[] | 'invalid' {
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 12 || seen.has(value)) {
      return 'invalid';
    }
    seen.add(value);
  }
  return [...seen].sort((left, right) => left - right);
}

export function toggleSeasonMonth(months: readonly number[], month: number): number[] {
  const next = months.includes(month) ? months.filter((value) => value !== month) : [...months, month];
  const parsed = parseSeasonMonths(next);
  return parsed === 'invalid' ? [...months] : parsed;
}

export function parseHarvestStatus(value: string | null): Availability | null | 'invalid' {
  if (value == null || value === '') {
    return null;
  }
  if ((AVAILABILITY as readonly string[]).includes(value)) {
    return value as Availability;
  }
  return 'invalid';
}

export function readSeasonMonths(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const months: number[] = [];
  for (const item of value) {
    const month = typeof item === 'number' ? item : Number(item);
    if (Number.isInteger(month) && month >= 1 && month <= 12 && !months.includes(month)) {
      months.push(month);
    }
  }
  return months.sort((left, right) => left - right);
}
