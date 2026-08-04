import { isLocale } from '@agrobridge/shared';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'conversationLocaleCode', async: false })
class LocaleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isLocale(value);
  }

  defaultMessage() {
    return 'locale must be one of ka, en, ru, de, fr, it, es';
  }
}

export class CreateConversationDto {
  @ValidateIf(
    (o: CreateConversationDto) => !o.farmerId && !o.purchaseRequestId && !o.buyerId,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  rfqId?: string;

  @ValidateIf(
    (o: CreateConversationDto) => !o.rfqId && !o.purchaseRequestId && !o.buyerId,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  farmerId?: string;

  @ValidateIf((o: CreateConversationDto) => !o.rfqId && !o.farmerId && !o.buyerId)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  purchaseRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  buyerId?: string;

  /** Active UI language of the opener; used when loading the new conversation. */
  @IsOptional()
  @IsString()
  @Validate(LocaleConstraint)
  locale?: string;
}
