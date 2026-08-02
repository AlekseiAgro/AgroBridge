import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateConversationDto {
  @ValidateIf((o: CreateConversationDto) => !o.farmerId)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  rfqId?: string;

  @ValidateIf((o: CreateConversationDto) => !o.rfqId)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  farmerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  buyerId?: string;
}
