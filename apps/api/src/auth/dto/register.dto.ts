import { isLegalLocale, isLocale, isRegisterableRole } from '@agrobridge/shared';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
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

@ValidatorConstraint({ name: 'legalLocaleCode', async: false })
class LegalLocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isLegalLocale(value);
  }

  defaultMessage() {
    return 'acceptedTermsLocale must be ka or en';
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

  /** Seller (farmer) or buyer — used for registration stats. Profile subtypes are set later in the cabinet. */
  @IsString()
  @Validate(RegisterableRoleConstraint)
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Validate(LocaleConstraint)
  locale?: string;

  @IsBoolean()
  @Equals(true, { message: 'Terms of Use must be accepted' })
  acceptTerms!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  acceptedTermsVersion!: string;

  @IsOptional()
  @IsString()
  @Validate(LegalLocaleConstraint)
  acceptedTermsLocale?: string;
}
