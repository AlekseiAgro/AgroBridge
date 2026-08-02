import { isProductCategory, isProductUnit } from '@agrobridge/shared';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'purchaseCategory', async: false })
class CategoryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isProductCategory(value);
  }

  defaultMessage() {
    return 'category is invalid';
  }
}

@ValidatorConstraint({ name: 'purchaseUnit', async: false })
class UnitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return value === undefined || value === null || value === ''
      ? true
      : typeof value === 'string' && isProductUnit(value);
  }

  defaultMessage() {
    return 'unit is invalid';
  }
}

export class CreatePurchaseRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @Validate(CategoryConstraint)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  quantity!: string;

  @IsOptional()
  @IsString()
  @Validate(UnitConstraint)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  variety?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  packaging?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinationCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
