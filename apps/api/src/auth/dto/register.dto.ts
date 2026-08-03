import { isLocale, isRegisterableRole } from '@agrobridge/shared';
import {
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
}
