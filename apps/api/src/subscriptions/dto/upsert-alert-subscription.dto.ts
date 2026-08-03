import { IsArray, IsBoolean, IsString } from 'class-validator';

export class UpsertAlertSubscriptionDto {
  @IsBoolean()
  notifyProducts!: boolean;

  @IsBoolean()
  notifyPurchaseRequests!: boolean;

  @IsBoolean()
  allCategories!: boolean;

  @IsArray()
  @IsString({ each: true })
  categories!: string[];

  @IsBoolean()
  allRegions!: boolean;

  @IsArray()
  @IsString({ each: true })
  regions!: string[];
}
