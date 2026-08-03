import { Injectable } from '@nestjs/common';
import type { CategoryConfigItem } from '@agrobridge/shared';
import { PRODUCT_CATEGORIES, mergeCategoryConfigs } from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<CategoryConfigItem[]> {
    const rows = await this.prisma.categoryConfig.findMany();
    return mergeCategoryConfigs(rows).filter((row) => row.enabled);
  }

  async enabledIds(): Promise<string[] | null> {
    const rows = await this.prisma.categoryConfig.findMany();
    if (rows.length === 0) {
      return null;
    }
    const enabled = rows.filter((row) => row.enabled).map((row) => row.id);
    // If configs exist but somehow none match known categories, fall back to all.
    if (enabled.length === 0 && rows.length < PRODUCT_CATEGORIES.length) {
      return PRODUCT_CATEGORIES.filter(
        (id) => !rows.some((row) => row.id === id && !row.enabled),
      ) as string[];
    }
    return enabled;
  }
}
