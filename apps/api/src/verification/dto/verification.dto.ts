import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConfirmCodeDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class SendSmsCodeDto {
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone!: string;
}

export class CompanyRegistryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  registrationNumber!: string;
}

export class OptionalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
