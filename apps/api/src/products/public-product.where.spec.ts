import { INTERNAL_DRAFT_PRODUCT_TITLES } from '@agrobridge/shared';
import { publicProductWhere, publicProductWhereAnd } from './public-product.where';

describe('publicProductWhere', () => {
  it('requires published + approved and excludes internal draft titles', () => {
    expect(publicProductWhere.isPublished).toBe(true);
    expect(publicProductWhere.moderationStatus).toBe('approved');
    expect(publicProductWhere.AND).toEqual(
      expect.arrayContaining([
        { title: { not: '' } },
        { title: { notIn: [...INTERNAL_DRAFT_PRODUCT_TITLES] } },
      ]),
    );
    expect(INTERNAL_DRAFT_PRODUCT_TITLES).toContain('Новый товар');
  });

  it('keeps draft-title filters when extra catalog AND clauses are applied', () => {
    const where = publicProductWhereAnd([{ category: 'fruits' }]);
    expect(where.AND).toEqual([
      { title: { not: '' } },
      { title: { notIn: [...INTERNAL_DRAFT_PRODUCT_TITLES] } },
      { category: 'fruits' },
    ]);
  });
});
