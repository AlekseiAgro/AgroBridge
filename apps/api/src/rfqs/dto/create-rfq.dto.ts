import { isProductUnit } from '@agrobridge/shared';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'rfqUnit', async: false })
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

export class CreateRfqDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  productId!: string;

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
  @MaxLength(2000)
  message?: string;
}
