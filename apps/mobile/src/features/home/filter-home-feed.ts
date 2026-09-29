import type { ProductCategory } from '../../catalog/categories';
import type { MessageKey } from '../../i18n/en';
import { categoryLabelKey, regionLabelKey, type HomeFeed } from './types';

export function filterHomeFeed(
  feed: HomeFeed,
  input: {
    query: string;
    categoryId: ProductCategory | null;
    text: (key: MessageKey) => string;
  },
): HomeFeed {
  const query = input.query.trim().toLowerCase();

  const matches = (categoryId: ProductCategory, parts: string[]) => {
    if (input.categoryId && input.categoryId !== categoryId) {
      return false;
    }
    if (!query) {
      return true;
    }
    return parts.join('\n').toLowerCase().includes(query);
  };

  return {
    products: feed.products.filter((product) =>
      matches(product.categoryId, [
        input.text(product.nameKey),
        input.text(categoryLabelKey(product.categoryId)),
        input.text(regionLabelKey(product.regionId)),
        input.text('home.country.georgia'),
      ]),
    ),
    requests: feed.requests.filter((request) =>
      matches(request.categoryId, [
        input.text(request.titleKey),
        input.text(request.quantityKey),
        input.text(categoryLabelKey(request.categoryId)),
        input.text(regionLabelKey(request.regionId)),
      ]),
    ),
  };
}
