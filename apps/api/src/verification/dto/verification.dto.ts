import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConfirmCodeDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class SendSmsCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;
}

export class CompanyRegistryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  registrationNumber!: string;
}

export class SetSellerTypeDto {
  @IsString()
  @Matches(/^(privateFarmer|company)$/)
  sellerType!: 'privateFarmer' | 'company';
}

export class OptionalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
