import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RejectProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class BlockUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ReviewNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UploadDocumentMetaDto {
  @IsString()
  @MaxLength(200)
  title!: string;
}
