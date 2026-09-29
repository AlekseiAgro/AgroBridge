import type { HomeFeed } from './types';

/**
 * PRESENTATION ONLY.
 * Temporary Home layout samples. These are not production products, farms,
 * purchase requests, or statistics. A later PR should replace this module
 * with GET /products and GET /purchase-requests.
 * Image URLs are absolute so resolveMediaUrl leaves them unchanged.
 */
const presentationImage = (photo: string) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=80`;

export const presentationHomeFeed: HomeFeed = {
  products: [
    {
      id: 'presentation-saperavi',
      nameKey: 'fixtures.products.saperavi.name',
      categoryId: 'wine',
      regionId: 'kakheti',
      availability: 'available',
      verified: true,
      imageUrl: presentationImage('photo-1510812431401-41d2bd2722f3'),
      placement: 'featured',
    },
    {
      id: 'presentation-honey',
      nameKey: 'fixtures.products.honey.name',
      categoryId: 'honey',
      regionId: 'samegreloZemoSvaneti',
      availability: 'limited',
      verified: true,
      imageUrl: presentationImage('photo-1587049352846-4a222e784d38'),
      placement: 'featured',
    },
    {
      id: 'presentation-hazelnuts',
      nameKey: 'fixtures.products.hazelnuts.name',
      categoryId: 'nuts',
      regionId: 'guria',
      availability: 'available',
      verified: true,
      imageUrl: presentationImage('photo-1599599810769-bcde5a160d32'),
      placement: 'featured',
    },
    {
      id: 'presentation-water',
      nameKey: 'fixtures.products.water.name',
      categoryId: 'mineralWater',
      regionId: 'samtskheJavakheti',
      availability: 'available',
      verified: false,
      imageUrl: presentationImage('photo-1548839140-29a749e1cf4d'),
      placement: 'featured',
    },
    {
      id: 'presentation-tea',
      nameKey: 'fixtures.products.tea.name',
      categoryId: 'tea',
      regionId: 'guria',
      availability: 'growing',
      verified: true,
      imageUrl: presentationImage('photo-1556679343-c7306c1976bc'),
      placement: 'new',
    },
    {
      id: 'presentation-berries',
      nameKey: 'fixtures.products.berries.name',
      categoryId: 'berries',
      regionId: 'adjara',
      availability: 'available',
      verified: false,
      imageUrl: presentationImage('photo-1498557850523-fd3d118b962e'),
      placement: 'new',
    },
    {
      id: 'presentation-bay-leaf',
      nameKey: 'fixtures.products.bayLeaf.name',
      categoryId: 'bayLeaf',
      regionId: 'samegreloZemoSvaneti',
      availability: 'limited',
      verified: true,
      imageUrl: presentationImage('photo-1466637574441-749b8f19452f'),
      placement: 'new',
    },
  ],
  requests: [
    {
      id: 'presentation-request-hazelnuts',
      titleKey: 'fixtures.requests.hazelnuts.title',
      quantityKey: 'fixtures.requests.hazelnuts.quantity',
      categoryId: 'nuts',
      regionId: 'guria',
    },
    {
      id: 'presentation-request-grapes',
      titleKey: 'fixtures.requests.grapes.title',
      quantityKey: 'fixtures.requests.grapes.quantity',
      categoryId: 'fruits',
      regionId: 'kakheti',
    },
    {
      id: 'presentation-request-honey',
      titleKey: 'fixtures.requests.honey.title',
      quantityKey: 'fixtures.requests.honey.quantity',
      categoryId: 'honey',
      regionId: 'samegreloZemoSvaneti',
    },
  ],
};

export async function loadHomeFeed(): Promise<HomeFeed> {
  return presentationHomeFeed;
}
