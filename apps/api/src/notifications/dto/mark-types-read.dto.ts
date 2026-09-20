import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class MarkNotificationTypesReadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  types!: string[];
}
