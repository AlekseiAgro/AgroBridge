import { RATING_MAX_SCORE, RATING_MIN_SCORE } from '@agrobridge/shared';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRatingDto {
  @IsString()
  @MinLength(1)
  rfqId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(RATING_MIN_SCORE)
  @Max(RATING_MAX_SCORE)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
