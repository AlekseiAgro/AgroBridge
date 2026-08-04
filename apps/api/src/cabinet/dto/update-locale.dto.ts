import { isLocale } from '@agrobridge/shared';
import { IsString, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'cabinetLocaleCode', async: false })
class LocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isLocale(value);
  }

  defaultMessage() {
    return 'locale must be one of ka, en, ru, de, fr, it, es';
  }
}

export class UpdateLocaleDto {
  @IsString()
  @Validate(LocaleConstraint)
  locale!: string;
}
