import { isCurrencyCode, isProductUnit } from '@agrobridge/shared';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'currencyCode', async: false })
class CurrencyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isCurrencyCode(value);
  }

  defaultMessage() {
    return 'currency must be GEL, EUR, or USD';
  }
}

@ValidatorConstraint({ name: 'offerUnit', async: false })
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

export class CreateOfferDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'priceAmount must be a positive number with up to 2 decimals',
  })
  priceAmount!: string;

  @IsString()
  @Validate(CurrencyConstraint)
  currency!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  quantity?: string;

  @IsOptional()
  @IsString()
  @Validate(UnitConstraint)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}
