import { INTERNAL_DRAFT_PRODUCT_TITLES } from '@agrobridge/shared';
import { ModerationStatus as PrismaModerationStatus, type Prisma } from '@prisma/client';

const publicTitleWhere: Prisma.ProductWhereInput[] = [
  { title: { not: '' } },
  { title: { notIn: [...INTERNAL_DRAFT_PRODUCT_TITLES] } },
];

/** Catalog / farm / profile visitor filter. Draft placeholder titles stay hidden. */
export function publicProductWhereAnd(
  extra: Prisma.ProductWhereInput[] = [],
): Prisma.ProductWhereInput {
  return {
    isPublished: true,
    moderationStatus: PrismaModerationStatus.approved,
    AND: [...publicTitleWhere, ...extra],
  };
}

export const publicProductWhere = publicProductWhereAnd();
