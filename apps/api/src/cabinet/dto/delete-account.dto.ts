import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestAccountDeletionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class ConfirmAccountDeletionDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
