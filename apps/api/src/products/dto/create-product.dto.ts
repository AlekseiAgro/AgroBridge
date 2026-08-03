import {
  isHarvestStatus,
  isProductCategory,
  isProductUnit,
  normalizeSeasonMonths,
} from '@agrobridge/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'productCategory', async: false })
class ProductCategoryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return value === undefined || value === null || value === ''
      ? true
      : typeof value === 'string' && isProductCategory(value);
  }

  defaultMessage() {
    return 'category is invalid';
  }
}

@ValidatorConstraint({ name: 'productUnit', async: false })
class ProductUnitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return value === undefined || value === null || value === ''
      ? true
      : typeof value === 'string' && isProductUnit(value);
  }

  defaultMessage() {
    return 'unit is invalid';
  }
}

@ValidatorConstraint({ name: 'harvestStatus', async: false })
class HarvestStatusConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return value === undefined || value === null || value === ''
      ? true
      : typeof value === 'string' && isHarvestStatus(value);
  }

  defaultMessage() {
    return 'harvestStatus is invalid';
  }
}

@ValidatorConstraint({ name: 'seasonMonths', async: false })
class SeasonMonthsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null) return true;
    if (!Array.isArray(value)) return false;
    return normalizeSeasonMonths(value).length === value.length;
  }

  defaultMessage() {
    return 'seasonMonths must be integers from 1 to 12';
  }
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variety?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  originPlace?: string;

  @IsOptional()
  @IsString()
  @Validate(ProductCategoryConstraint)
  category?: string;

  @IsOptional()
  @IsString()
  @Validate(ProductUnitConstraint)
  unit?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  minQuantity?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxQuantity?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  currentStock?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monthlyProduction?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxAnnualProduction?: number | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  packagingTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  packagingWeights?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  palletSize?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  incoterms?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  carriers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customDelivery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nearestPort?: string;

  @IsOptional()
  @IsBoolean()
  deliveryAvailable?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber()
  priceFrom?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  priceCurrency?: string;

  @IsOptional()
  @IsBoolean()
  priceNegotiable?: boolean;

  @IsOptional()
  @IsBoolean()
  priceDependsOnVolume?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Type(() => Number)
  @Validate(SeasonMonthsConstraint)
  seasonMonths?: number[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsDateString()
  harvestStartAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsDateString()
  harvestEndAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999)
  forecastQuantity?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsString()
  @Validate(HarvestStatusConstraint)
  harvestStatus?: string | null;

  @IsOptional()
  @IsBoolean()
  preorderEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
