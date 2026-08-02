import { isProductCategory, isProductUnit } from '@agrobridge/shared';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
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
  @IsBoolean()
  isPublished?: boolean;
}
