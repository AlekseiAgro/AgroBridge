import { translate } from '../../i18n/translate';
import { presentationHomeFeed } from './fixtures';
import { filterHomeFeed } from './filter-home-feed';

const text = (key: Parameters<typeof translate>[1]) => translate('en', key);

describe('filterHomeFeed', () => {
  it('returns the presentation feed when nothing is selected', () => {
    const filtered = filterHomeFeed(presentationHomeFeed, {
      query: '',
      categoryId: null,
      text,
    });
    expect(filtered.products).toHaveLength(presentationHomeFeed.products.length);
    expect(filtered.requests).toHaveLength(presentationHomeFeed.requests.length);
  });

  it('filters by category across products and purchase requests', () => {
    const filtered = filterHomeFeed(presentationHomeFeed, {
      query: '  ',
      categoryId: 'honey',
      text,
    });
    expect(filtered.products.map((product) => product.id)).toEqual(['presentation-honey']);
    expect(filtered.requests.map((request) => request.id)).toEqual(['presentation-request-honey']);
  });

  it('matches a localized product name', () => {
    const filtered = filterHomeFeed(presentationHomeFeed, {
      query: 'горный',
      categoryId: null,
      text: (key) => translate('ru', key),
    });
    expect(filtered.products.map((product) => product.id)).toEqual(['presentation-honey']);
  });
});
