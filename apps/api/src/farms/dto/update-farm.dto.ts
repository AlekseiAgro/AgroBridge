import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFarmDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
