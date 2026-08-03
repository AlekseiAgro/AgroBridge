import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestEmailChangeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsEmail()
  @MaxLength(255)
  newEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
