import { GEORGIA_REGIONS } from '@agrobridge/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Official region list size. A catalog request may name each region once.
 * One legacy region string still fits, which keeps `?region=imereti` valid.
 */
export const CATALOG_REGION_LIMIT = GEORGIA_REGIONS.length;

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

/**
 * Accepts the historical single `region` string and repeated `region` parameters.
 * `?region=kakheti&region=imereti` is an OR match. Comma-separated values stay one string.
 * Blank entries are dropped. Repeated names collapse without regard to case.
 * Non-strings are kept so validation can reject them.
 */
export function toCatalogRegionQuery(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const raw: unknown[] = Array.isArray(value) ? value : [value];
  const items = raw
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');
  if (items.length === 0) return undefined;
  const seen = new Set<string>();
  const unique: unknown[] = [];
  for (const item of items) {
    if (typeof item !== 'string') {
      unique.push(item);
      continue;
    }
    const key = item.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/** Region names ready for the catalog WHERE clause. Invalid entries are ignored here. */
export function normalizeCatalogRegions(
  value: string | readonly string[] | null | undefined,
): string[] {
  const parsed = toCatalogRegionQuery(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  /**
   * One region, or several repeated `region` parameters matched with OR.
   * `?region=imereti` remains valid. Each value keeps the 120-character limit.
   */
  @IsOptional()
  @Transform(({ value }) => toCatalogRegionQuery(value))
  @IsArray()
  @ArrayMaxSize(CATALOG_REGION_LIMIT)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  region?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  harvestStatus?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  preorder?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  inSeason?: boolean;

  /** Newest public products by creation time. Omitted listings stay in updatedAt order. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  newest?: number;
}
