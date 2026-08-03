import { isBuyerType, isLocale, isRegisterableRole, isSellerType } from '@agrobridge/shared';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'registerableRole', async: false })
class RegisterableRoleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isRegisterableRole(value);
  }

  defaultMessage() {
    return 'role must be farmer or buyer';
  }
}

@ValidatorConstraint({ name: 'localeCode', async: false })
class LocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isLocale(value);
  }

  defaultMessage() {
    return 'locale must be one of ka, en, ru, de, fr, it, es';
  }
}

@ValidatorConstraint({ name: 'sellerType', async: false })
class SellerTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isSellerType(value);
  }

  defaultMessage() {
    return 'sellerType must be privateFarmer or company';
  }
}

@ValidatorConstraint({ name: 'buyerType', async: false })
class BuyerTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isBuyerType(value);
  }

  defaultMessage() {
    return 'buyerType must be individual or company';
  }
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Validate(RegisterableRoleConstraint)
  role!: string;

  /** Required when registering as a farmer/seller; optional otherwise (defaults applied). */
  @ValidateIf((dto: RegisterDto) => dto.role === 'farmer' || dto.sellerType != null)
  @IsString()
  @Validate(SellerTypeConstraint)
  sellerType?: string;

  /** Required when registering as a buyer; optional otherwise (defaults applied). */
  @ValidateIf((dto: RegisterDto) => dto.role === 'buyer' || dto.buyerType != null)
  @IsString()
  @Validate(BuyerTypeConstraint)
  buyerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Validate(LocaleConstraint)
  locale?: string;
}
