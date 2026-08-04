import { isLocale } from '@agrobridge/shared';
import { IsOptional, IsString, MaxLength, MinLength, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'messageLocaleCode', async: false })
class LocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isLocale(value);
  }

  defaultMessage() {
    return 'sourceLocale must be one of ka, en, ru, de, fr, it, es';
  }
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  /** Active UI language of the sender; preferred over the stored profile locale. */
  @IsOptional()
  @IsString()
  @Validate(LocaleConstraint)
  sourceLocale?: string;
}
