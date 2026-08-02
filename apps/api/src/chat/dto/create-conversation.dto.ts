import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

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
}
