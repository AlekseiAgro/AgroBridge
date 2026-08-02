import { isProductCategory, isProductUnit } from '@agrobridge/shared';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsBoolean()
  isPublished?: boolean;
}
