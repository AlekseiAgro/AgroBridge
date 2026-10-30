import { formatListedPrice } from '../catalog/model';
import {
  filterMyProducts,
  HARVEST_STATUS_CHOICES,
  harvestBadgeKey,
  harvestChoiceSelected,
  harvestStatusPatch,
  keepMyProductsAfterError,
  myProductsLoadMode,
  myProductsPhase,
  myProductsRefreshVisible,
  openAvailabilitySheet,
  parseSellerProduct,
  parseSellerProducts,
  productsAfterHarvestUpdate,
  sellerListStatus,
  sellerEditDestination,
  sellerMetricCount,
  sellerPreviewDestination,
  sellerPriceLine,
  sellerProductDestination,
  sellerProductImageUrl,
  sellerProductOpensPublicDetail,
  sellerProductStatus,
  sellerRejectionNote,
  shouldLoadMyProducts,
  showMyProductsEntry,
  UPDATE_AVAILABILITY_KEY,
} from './products';

const image = {
  url: 'https://media.agrobridge.ge/products/p1/photo.jpg',
  isPrimary: true,
  sortOrder: 0,
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'Green tea',
    priceFrom: 6,
    priceCurrency: 'GEL',
    unit: 'kg',
    isPublished: false,
    moderationStatus: 'draft',
    moderationNote: null,
    harvestStatus: 'available',
    images: [image],
    ...overrides,
  };
}

describe('my products access', () => {
  it('does not load for signed-out or unverified users', () => {
    expect(shouldLoadMyProducts({ user: null, profileUnavailable: false })).toBe(false);
    expect(shouldLoadMyProducts({ user: { emailVerified: false }, profileUnavailable: false })).toBe(false);
    expect(shouldLoadMyProducts({ user: { emailVerified: true }, profileUnavailable: true })).toBe(false);
    expect(shouldLoadMyProducts({ user: { emailVerified: true }, profileUnavailable: false })).toBe(true);
  });

  it('shows the account entry only for a verified signed-in user', () => {
    expect(
      showMyProductsEntry({ authStatus: 'anonymous', profileUnavailable: false, emailVerified: false }),
    ).toBe(false);
    expect(
      showMyProductsEntry({ authStatus: 'authenticated', profileUnavailable: false, emailVerified: false }),
    ).toBe(false);
    expect(
      showMyProductsEntry({ authStatus: 'authenticated', profileUnavailable: true, emailVerified: true }),
    ).toBe(false);
    expect(
      showMyProductsEntry({ authStatus: 'authenticated', profileUnavailable: false, emailVerified: true }),
    ).toBe(true);
  });

  it('keeps signed-out and unverified phases off the product request', () => {
    expect(
      myProductsPhase({
        authStatus: 'anonymous',
        user: null,
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('signedOut');
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: false },
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('unverified');
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'loading',
        count: 0,
      }),
    ).toBe('loading');
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'ready',
        count: 0,
      }),
    ).toBe('empty');
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'ready',
        count: 2,
      }),
    ).toBe('list');
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'error',
        count: 0,
      }),
    ).toBe('error');
  });
});

describe('seller product cards', () => {
  it('keeps the API order and the original title', () => {
    const products = parseSellerProducts([
      product({ id: 'newer', title: 'Bay leaf', source: { title: 'Bay leaf' } }),
      product({
        id: 'older',
        title: 'Чай зеленый',
        display: { title: 'Green tea' },
        source: { title: 'Чай зеленый' },
      }),
    ]);

    expect(products.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(products[1]?.title).toBe('Чай зеленый');
  });

  it('renders title, image, and price when the product has them', () => {
    const parsed = parseSellerProduct(product());
    expect(parsed?.title).toBe('Green tea');
    expect(sellerProductImageUrl(parsed?.images ?? [])).toBe(image.url);
    expect(sellerPriceLine(parsed?.priceFrom ?? null, parsed?.priceCurrency ?? null, 'kg')).toBe('₾ 6.00 / kg');
    expect(formatListedPrice(null, 'GEL', 'kg')).toBeNull();
    expect(sellerPriceLine(6, null, 'kg')).toBeNull();
  });

  it('omits a category placeholder photo', () => {
    const parsed = parseSellerProduct(
      product({ images: [{ url: '/images/categories/tea.jpg', isPrimary: true, sortOrder: 0 }] }),
    );
    expect(sellerProductImageUrl(parsed?.images ?? [])).toBeNull();
  });

  it('maps draft, pending, published, and rejected', () => {
    expect(sellerProductStatus(product({ moderationStatus: 'draft', isPublished: false }))).toBe('draft');
    expect(sellerProductStatus(product({ moderationStatus: 'pending', isPublished: true }))).toBe('pending');
    expect(sellerProductStatus(product({ moderationStatus: 'approved', isPublished: true }))).toBe('published');
    expect(sellerProductStatus(product({ moderationStatus: 'approved', isPublished: false }))).toBe('draft');
    expect(sellerProductStatus(product({ moderationStatus: 'rejected', isPublished: true }))).toBe('rejected');
  });

  it('shows a rejection note only when the list includes one', () => {
    const rejected = product({
      moderationStatus: 'rejected',
      isPublished: true,
      moderationNote: 'Photos are unclear',
    });
    expect(sellerRejectionNote(rejected)).toBe('Photos are unclear');
    expect(sellerRejectionNote({ ...rejected, moderationNote: '   ' })).toBeNull();
    expect(sellerRejectionNote({ ...rejected, moderationNote: null })).toBeNull();
    expect(
      sellerRejectionNote(product({ moderationStatus: 'pending', moderationNote: 'Photos are unclear' })),
    ).toBeNull();
  });

  it('opens product detail for every lifecycle state and keeps edit as a second step', () => {
    const published = parseSellerProduct(
      product({ moderationStatus: 'approved', isPublished: true, viewCount: 124, watchCount: 8 }),
    );
    const draft = parseSellerProduct(product({ moderationStatus: 'draft', isPublished: false }));
    const pending = parseSellerProduct(product({ moderationStatus: 'pending', isPublished: true }));
    const rejected = parseSellerProduct(product({ moderationStatus: 'rejected', isPublished: true }));
    const placeholder = parseSellerProduct(
      product({ title: 'Untitled product', moderationStatus: 'approved', isPublished: true }),
    );
    const view = {
      screen: 'ProductDetail' as const,
      params: { productId: 'p1', ownerPreview: true as const },
    };
    const editor = { screen: 'EditProduct' as const, params: { productId: 'p1' } };

    expect(published && sellerProductOpensPublicDetail(published)).toBe(true);
    expect(published && sellerProductDestination(published)).toEqual(view);
    expect(published && sellerEditDestination(published)).toEqual(editor);
    expect(draft && sellerProductDestination(draft)).toEqual(view);
    expect(draft && sellerEditDestination(draft)).toEqual(editor);
    expect(pending && sellerProductDestination(pending)).toEqual(view);
    expect(rejected && sellerProductDestination(rejected)).toEqual(view);
    expect(placeholder && sellerProductOpensPublicDetail(placeholder)).toBe(false);
    expect(placeholder && sellerProductDestination(placeholder)).toEqual(view);
    expect(placeholder && sellerEditDestination(placeholder)).toEqual(editor);
    expect(published?.viewCount).toBe(124);
    expect(published?.watchCount).toBe(8);
    expect(sellerMetricCount(published?.viewCount)).toBe(124);
    expect(sellerMetricCount(draft?.viewCount)).toBe(0);
    expect(sellerMetricCount(draft?.watchCount)).toBe(0);
  });

  it('keeps owner metrics when a harvest update omits them', () => {
    const listed = parseSellerProduct(product({ viewCount: 12, watchCount: 3, harvestStatus: 'available' }));
    const limited = parseSellerProduct(product({ harvestStatus: 'limited' }));
    const updated = listed && limited ? productsAfterHarvestUpdate([listed], limited) : [];
    expect(updated[0]).toMatchObject({
      harvestStatus: 'limited',
      viewCount: 12,
      watchCount: 3,
    });
    expect(harvestBadgeKey(updated[0]?.harvestStatus ?? null)).toBe('availability.limited');
  });
});

describe('my products refresh', () => {
  it('refreshes a loaded list when the seller returns after publishing', () => {
    expect(myProductsRefreshVisible('list')).toBe(true);
    expect(myProductsRefreshVisible('empty')).toBe(true);
    expect(myProductsRefreshVisible('loading')).toBe(false);
    expect(myProductsRefreshVisible('error')).toBe(false);
    expect(myProductsLoadMode(false)).toBe('initial');
    expect(myProductsLoadMode(true)).toBe('refresh');
    expect(keepMyProductsAfterError(false)).toBe(false);
    expect(keepMyProductsAfterError(true)).toBe(true);
  });
});

describe('my products filters and preview', () => {
  const rows = [
    product({ id: 'draft', moderationStatus: 'draft', isPublished: false }),
    product({ id: 'pending', moderationStatus: 'pending', isPublished: true }),
    product({ id: 'live', moderationStatus: 'approved', isPublished: true, harvestStatus: 'soldOut' }),
    product({ id: 'held', moderationStatus: 'approved', isPublished: false }),
    product({ id: 'rejected', moderationStatus: 'rejected', isPublished: true }),
  ].flatMap((row) => {
    const parsed = parseSellerProduct(row);
    return parsed ? [parsed] : [];
  });

  it('keeps every product on All and filters published and pending without duplicates', () => {
    expect(filterMyProducts(rows, 'all').map((item) => item.id)).toEqual([
      'draft',
      'pending',
      'live',
      'held',
      'rejected',
    ]);
    expect(filterMyProducts(rows, 'published').map((item) => item.id)).toEqual(['live']);
    expect(filterMyProducts(rows, 'pending').map((item) => item.id)).toEqual(['pending']);
    expect(new Set(filterMyProducts(rows, 'all').map((item) => item.id)).size).toBe(rows.length);
  });

  it('keeps sold out separate from moderation and previews through the public detail route', () => {
    expect(sellerListStatus(rows[2]!)).toBe('published');
    expect(sellerListStatus(rows[3]!)).toBe('approvedUnpublished');
    expect(sellerProductStatus(rows[3]!)).toBe('draft');
    expect(UPDATE_AVAILABILITY_KEY).toBe('seller.products.updateAvailability');
    expect(openAvailabilitySheet('draft')).toEqual({ productId: 'draft' });
    expect(HARVEST_STATUS_CHOICES).toEqual([null, 'growing', 'available', 'limited', 'soldOut']);
    expect(harvestBadgeKey(null)).toBe('seller.draft.harvestStatusUnset');
    expect(harvestBadgeKey('growing')).toBe('availability.growing');
    expect(harvestBadgeKey('available')).toBe('availability.available');
    expect(harvestBadgeKey('limited')).toBe('availability.limited');
    expect(harvestBadgeKey('soldOut')).toBe('availability.soldOut');
    expect(harvestChoiceSelected('soldOut', 'soldOut')).toBe(true);
    expect(harvestChoiceSelected('soldOut', 'available')).toBe(false);
    expect(harvestChoiceSelected(null, null)).toBe(true);
    expect(harvestStatusPatch('available', 'dismiss')).toBeNull();
    expect(harvestStatusPatch('available', 'available')).toBeNull();
    expect(harvestStatusPatch('available', null)).toEqual({ harvestStatus: null });
    expect(harvestStatusPatch(null, 'growing')).toEqual({ harvestStatus: 'growing' });
    expect(harvestStatusPatch('growing', 'available')).toEqual({ harvestStatus: 'available' });
    expect(harvestStatusPatch('available', 'limited')).toEqual({ harvestStatus: 'limited' });
    expect(harvestStatusPatch('limited', 'soldOut')).toEqual({ harvestStatus: 'soldOut' });
    for (const row of rows) {
      expect(openAvailabilitySheet(row.id).productId).toBe(row.id);
    }
    expect(sellerPreviewDestination(rows[0]!)).toEqual({
      screen: 'ProductDetail',
      params: { productId: 'draft', ownerPreview: true },
    });
    expect(productsAfterHarvestUpdate(rows, { ...rows[2]!, harvestStatus: 'limited' })[2]?.harvestStatus).toBe(
      'limited',
    );
    expect(sellerProductDestination(rows[0]!).screen).toBe('ProductDetail');
    expect(sellerEditDestination(rows[0]!).screen).toBe('EditProduct');
  });
});
