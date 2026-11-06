import { ApiError } from '../api/errors';
import {
  applyCategoryChoice,
  PRICE_CURRENCIES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from '../catalog/categories';
import { categoryLabel, unitLabel } from '../catalog/labels';
import { translate } from '../i18n/translate';
import {
  createDraftPhase,
  draftBodyHasForbiddenField,
  draftFailure,
  draftIssue,
  draftRequestBody,
  parseDraftPrice,
  editorAfterDraft,
  routeAfterDraft,
  showCreateProductAction,
  submitProductDraft,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_TITLE_MAX,
  type DraftCommercialInput,
  type DraftGate,
} from './draft';
import { parseSellerProducts, sellerProductDestination, sellerProductStatus } from './products';

const created = {
  id: 'p-new',
  title: 'Green tea',
  priceFrom: null,
  priceCurrency: null,
  unit: null,
  isPublished: false,
  moderationStatus: 'draft',
  moderationNote: null,
  harvestStatus: null,
  images: [],
};

describe('create product draft form', () => {
  it('stays closed for signed-out and unverified users', () => {
    expect(createDraftPhase({ authStatus: 'anonymous', user: null, profileUnavailable: false })).toBe('signedOut');
    expect(
      createDraftPhase({
        authStatus: 'authenticated',
        user: { emailVerified: false },
        profileUnavailable: false,
      }),
    ).toBe('unverified');
    expect(
      createDraftPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
      }),
    ).toBe('form');
  });

  it('shows Create Product from a loaded My Products list or empty state', () => {
    expect(showCreateProductAction('list')).toBe(true);
    expect(showCreateProductAction('empty')).toBe(true);
    expect(showCreateProductAction('signedOut')).toBe(false);
    expect(showCreateProductAction('unverified')).toBe(false);
    expect(showCreateProductAction('loading')).toBe(false);
  });

  it('blocks an empty or whitespace-only title and allows a title without a description', () => {
    expect(draftIssue('', '')).toBe('titleRequired');
    expect(draftIssue('   \n  ', '')).toBe('titleRequired');
    expect(draftIssue('A', '')).toBe('titleTooShort');
    expect(draftIssue('T'.repeat(PRODUCT_TITLE_MAX + 1), '')).toBe('titleTooLong');
    expect(draftIssue('Tea', 'D'.repeat(PRODUCT_DESCRIPTION_MAX + 1))).toBe('descriptionTooLong');
    expect(draftIssue('  Tea  ', '')).toBeNull();
    expect(draftRequestBody('  Tea  ', '   ')).toEqual({
      title: 'Tea',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      preorderEnabled: false,
      deliveryAvailable: false,
      isPublished: false,
    });
  });

  it('trims the title and surrounding description whitespace without dropping line breaks', () => {
    const body = draftRequestBody('  Green tea  ', '  First line\nSecond line  ');
    expect(body).toEqual({
      title: 'Green tea',
      description: 'First line\nSecond line',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      preorderEnabled: false,
      deliveryAvailable: false,
      isPublished: false,
    });
    expect(body && draftBodyHasForbiddenField(body)).toBe(false);
    expect(body && Object.keys(body).sort()).toEqual([
      'deliveryAvailable',
      'description',
      'isPublished',
      'preorderEnabled',
      'priceDependsOnVolume',
      'priceNegotiable',
      'title',
    ]);
  });

  it('ignores a second submit while the first is in flight', async () => {
    const gate: DraftGate = { pending: true };
    const create = jest.fn();
    const pending: boolean[] = [];
    const result = await submitProductDraft({
      title: 'Tea',
      description: '',
      gate,
      create,
      onPending: (value) => pending.push(value),
    });
    expect(result).toEqual({ status: 'ignored' });
    expect(create).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
  });

  it('reports loading and returns to My Products after a draft is created', async () => {
    const gate: DraftGate = { pending: false };
    const pending: boolean[] = [];
    const result = await submitProductDraft({
      title: '  Green tea  ',
      description: '',
      gate,
      create: async (body) => {
        expect(body).toEqual({
          title: 'Green tea',
          priceNegotiable: false,
          priceDependsOnVolume: false,
          preorderEnabled: false,
          deliveryAvailable: false,
          isPublished: false,
        });
        return created;
      },
      onPending: (value) => pending.push(value),
    });
    expect(pending).toEqual([true, false]);
    expect(gate.pending).toBe(false);
    expect(result.status).toBe('created');
    expect(routeAfterDraft(result.status)).toBe('MyProducts');
    expect(editorAfterDraft(result)).toBe('p-new');
    if (result.status === 'created') {
      const listed = parseSellerProducts([result.product]);
      expect(listed.map((item) => item.title)).toEqual(['Green tea']);
      expect(sellerProductStatus(listed[0]!)).toBe('draft');
      expect(sellerProductDestination(listed[0]!)).toEqual({
        screen: 'ProductDetail',
        params: { productId: listed[0]!.id, ownerPreview: true },
      });
    }
  });

  it('keeps the form and allows another save when the request fails', async () => {
    const gate: DraftGate = { pending: false };
    const title = '  Green tea  ';
    const description = '  Fresh\nleaf  ';
    let calls = 0;
    const create = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new ApiError({ message: 'Failed', status: 500, kind: 'http' });
      }
      return created;
    });
    const failed = await submitProductDraft({
      title,
      description,
      gate,
      create,
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'generic' });
    expect(title).toBe('  Green tea  ');
    expect(description).toBe('  Fresh\nleaf  ');
    expect(routeAfterDraft(failed.status)).toBeNull();
    expect(editorAfterDraft(failed)).toBeNull();
    expect(gate.pending).toBe(false);

    const retried = await submitProductDraft({
      title,
      description,
      gate,
      create,
      onPending: () => undefined,
    });
    expect(retried.status).toBe('created');
    expect(calls).toBe(2);
  });

  it('classifies validation, auth, rate limit, and network failures', () => {
    expect(draftFailure(new ApiError({ message: 'title', status: 400, kind: 'http' }))).toBe('validation');
    expect(draftFailure(new ApiError({ message: 'Unauthorized', status: 401, kind: 'http' }))).toBe('unauthorized');
    expect(draftFailure(new ApiError({ message: 'Confirm your email', status: 403, kind: 'http' }))).toBe(
      'forbidden',
    );
    expect(draftFailure(new ApiError({ message: 'Too many attempts. Try again later.', status: 429, kind: 'http' }))).toBe(
      'rateLimit',
    );
    expect(draftFailure(new ApiError({ message: 'Network request failed.', status: 0, kind: 'network' }))).toBe(
      'network',
    );
  });
});

const commercial = (overrides: Partial<DraftCommercialInput> = {}): DraftCommercialInput => ({
  category: null,
  variety: '',
  country: '',
  originPlace: '',
  unit: null,
  minQuantity: '',
  maxQuantity: '',
  currentStock: '',
  monthlyProduction: '',
  maxAnnualProduction: '',
  price: '',
  currency: null,
  priceNegotiable: false,
  priceDependsOnVolume: false,
  seasonMonths: [],
  harvestStartAt: '',
  harvestEndAt: '',
  forecastQuantity: '',
  harvestStatus: null,
  preorderEnabled: false,
  packagingTypes: [],
  packagingWeightsText: '',
  palletSize: '',
  deliveryAvailable: false,
  incoterms: [],
  carriers: [],
  customDelivery: '',
  nearestPort: '',
  leadTimeDays: '',
  ...overrides,
});

describe('create product draft commercial fields', () => {
  it('uses the shared category, unit, and currency codes', () => {
    expect(PRODUCT_CATEGORIES).toEqual([
      'fruits',
      'vegetables',
      'berries',
      'nuts',
      'wine',
      'dairy',
      'honey',
      'mineralWater',
      'spices',
      'tea',
      'bayLeaf',
      'essentialOils',
      'organic',
      'other',
    ]);
    expect(PRODUCT_UNITS).toEqual(['kg', 'ton', 'box', 'liter', 'bottle', 'piece']);
    expect(PRICE_CURRENCIES).toEqual(['GEL', 'EUR', 'USD']);
    expect(categoryLabel('tea', (key) => translate('ru', key))).toBe('Чай');
    expect(categoryLabel('tea', (key) => translate('ka', key))).toBe('ჩაი');
    expect(unitLabel('kg', (key) => translate('ru', key))).toBe('кг');
  });

  it('suggests the web default unit until the seller chooses one', () => {
    expect(applyCategoryChoice('tea', null, false)).toEqual({ category: 'tea', unit: 'kg' });
    expect(applyCategoryChoice('wine', null, false)).toEqual({ category: 'wine', unit: 'bottle' });
    expect(applyCategoryChoice('essentialOils', 'kg', true)).toEqual({
      category: 'essentialOils',
      unit: 'kg',
    });
    expect(applyCategoryChoice(null, 'kg', false)).toEqual({ category: null, unit: null });
  });

  it('omits empty category, unit, price, and currency', () => {
    expect(draftRequestBody('Tea', '', commercial())).toEqual({
      title: 'Tea',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      preorderEnabled: false,
      deliveryAvailable: false,
      isPublished: false,
    });
    expect(parseDraftPrice('')).toBeNull();
    expect(parseDraftPrice('   ')).toBeNull();
  });

  it('omits empty variety, country, and origin place and sends trimmed values', () => {
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('variety');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('country');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('originPlace');
    expect(draftRequestBody('Tea', '', commercial())?.isPublished).toBe(false);
    expect(
      draftRequestBody(
        'Tea',
        '',
        commercial({ variety: '  Kolkhuri  green ', country: 'Georgia', originPlace: '  Kakheti  region ' }),
      ),
    ).toMatchObject({
      variety: 'Kolkhuri  green',
      country: 'Georgia',
      originPlace: 'Kakheti  region',
      isPublished: false,
    });
    expect(draftIssue('Tea', '', commercial({ variety: 'v'.repeat(120) }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ variety: 'v'.repeat(121) }))).toBe('varietyTooLong');
    expect(draftIssue('Tea', '', commercial({ country: 'c'.repeat(80) }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ country: 'c'.repeat(81) }))).toBe('countryTooLong');
    expect(draftIssue('Tea', '', commercial({ originPlace: 'p'.repeat(160) }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ originPlace: 'p'.repeat(161) }))).toBe('originPlaceTooLong');
    expect(draftRequestBody('Tea', '', commercial({ variety: 'v'.repeat(121) }))).toBeNull();
  });

  it('serializes quantity and production fields and omits empty ones', () => {
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('minQuantity');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('currentStock');
    expect(
      draftRequestBody(
        'Tea',
        '',
        commercial({
          minQuantity: '0.50',
          maxQuantity: '12',
          currentStock: '  3.5 ',
          monthlyProduction: '10.25',
          maxAnnualProduction: '100',
        }),
      ),
    ).toMatchObject({
      minQuantity: 0.5,
      maxQuantity: 12,
      currentStock: 3.5,
      monthlyProduction: 10.25,
      maxAnnualProduction: 100,
      isPublished: false,
    });
    expect(draftIssue('Tea', '', commercial({ minQuantity: '0' }))).toBe('quantityInvalid');
    expect(draftIssue('Tea', '', commercial({ currentStock: '-1' }))).toBe('quantityInvalid');
    expect(draftIssue('Tea', '', commercial({ monthlyProduction: '1.555' }))).toBe('quantityInvalid');
    expect(draftIssue('Tea', '', commercial({ maxAnnualProduction: 'abc' }))).toBe('quantityInvalid');
    expect(draftIssue('Tea', '', commercial({ minQuantity: '10', maxQuantity: '2' }))).toBe('quantityRangeInvalid');
    expect(draftIssue('Tea', '', commercial({ minQuantity: '2', maxQuantity: '2' }))).toBeNull();
    expect(draftRequestBody('Tea', '', commercial({ minQuantity: '10', maxQuantity: '2' }))).toBeNull();
  });

  it('accepts dot and comma decimals for quantities and sends a number', () => {
    for (const value of ['0.5', '0,5', '1.2', '1,2', '1.20', '1,20']) {
      expect(parseDraftPrice(value)).toBe(value.startsWith('0') ? 0.5 : 1.2);
    }
    expect(parseDraftPrice('10.25')).toBe(10.25);
    expect(parseDraftPrice('10,25')).toBe(10.25);
    expect(parseDraftPrice('1')).toBe(1);
    expect(parseDraftPrice('0')).toBe('invalid');
    expect(parseDraftPrice('0.001')).toBe('invalid');
    expect(parseDraftPrice('0,001')).toBe('invalid');
    expect(parseDraftPrice('1.234')).toBe('invalid');
    expect(parseDraftPrice('1,234')).toBe('invalid');
    expect(parseDraftPrice('abc')).toBe('invalid');
    expect(draftIssue('Tea', '', commercial({ minQuantity: '0,5', maxQuantity: '1,2' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ minQuantity: '2', maxQuantity: '2' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ minQuantity: '10,5', maxQuantity: '2,5' }))).toBe(
      'quantityRangeInvalid',
    );
    const body = draftRequestBody('Tea', '', commercial({ currentStock: '0,5', price: '3,50' }));
    expect(body?.currentStock).toBe(0.5);
    expect(body?.priceFrom).toBe(3.5);
    expect(typeof body?.currentStock).toBe('number');
    expect(typeof body?.priceFrom).toBe('number');
    expect(body).not.toHaveProperty('minQuantity');
  });

  it('serializes harvest planning and omits empty optional fields', () => {
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('seasonMonths');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('harvestStartAt');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('forecastQuantity');
    expect(draftRequestBody('Tea', '', commercial())).not.toHaveProperty('harvestStatus');
    expect(draftRequestBody('Tea', '', commercial())?.preorderEnabled).toBe(false);
    const body = draftRequestBody(
      'Tea',
      '',
      commercial({
        forecastQuantity: '0,5',
        harvestStatus: 'growing',
        seasonMonths: [9, 6, 7],
        harvestStartAt: '2026-06-01',
        harvestEndAt: '2026-09-30',
        preorderEnabled: true,
      }),
    );
    expect(body).toMatchObject({
      forecastQuantity: 0.5,
      harvestStatus: 'growing',
      seasonMonths: [6, 7, 9],
      harvestStartAt: '2026-06-01',
      harvestEndAt: '2026-09-30',
      preorderEnabled: true,
      isPublished: false,
    });
    expect(typeof body?.forecastQuantity).toBe('number');
    expect(draftIssue('Tea', '', commercial({ forecastQuantity: '1.234' }))).toBe('forecastInvalid');
    expect(draftIssue('Tea', '', commercial({ forecastQuantity: '0' }))).toBe('forecastInvalid');
    expect(draftIssue('Tea', '', commercial({ forecastQuantity: '100000000' }))).toBe('forecastInvalid');
    expect(draftIssue('Tea', '', commercial({ forecastQuantity: '99999999' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ harvestStatus: 'ripe' }))).toBe('harvestStatusInvalid');
    expect(draftIssue('Tea', '', commercial({ seasonMonths: [1, 1] }))).toBe('seasonMonthsInvalid');
    expect(draftIssue('Tea', '', commercial({ seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ harvestStartAt: '2026-10-03', harvestEndAt: '2026-10-02' }))).toBe(
      'harvestDateOrder',
    );
    expect(draftIssue('Tea', '', commercial({ harvestStartAt: '2026-10-02', harvestEndAt: '2026-10-02' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ harvestStartAt: '2026-02-31' }))).toBe('harvestDateInvalid');
    expect(draftRequestBody('Tea', '', commercial({ harvestStartAt: '2026-06-01' }))).toMatchObject({
      harvestStartAt: '2026-06-01',
    });
    expect(draftRequestBody('Tea', '', commercial({ harvestEndAt: '2026-09-30' }))).not.toHaveProperty('harvestStartAt');
  });

  it('serializes packaging and delivery and omits empty optional fields', () => {
    const empty = draftRequestBody('Tea', '', commercial());
    expect(empty).toMatchObject({ deliveryAvailable: false, isPublished: false });
    expect(empty).not.toHaveProperty('packagingTypes');
    expect(empty).not.toHaveProperty('incoterms');
    expect(empty).not.toHaveProperty('leadTimeDays');
    const body = draftRequestBody(
      'Tea',
      '',
      commercial({
        packagingTypes: ['bag', 'carton'],
        packagingWeightsText: ' 5 kg, 10 kg, 5 kg ',
        palletSize: '  80x120  ',
        deliveryAvailable: true,
        incoterms: ['FOB', 'EXW'],
        carriers: ['DHL', 'other'],
        customDelivery: '  Call\nahead  ',
        nearestPort: ' Poti ',
        leadTimeDays: '14',
      }),
    );
    expect(body).toMatchObject({
      packagingTypes: ['bag', 'carton'],
      packagingWeights: ['5 kg', '10 kg'],
      palletSize: '80x120',
      deliveryAvailable: true,
      incoterms: ['FOB', 'EXW'],
      carriers: ['DHL', 'other'],
      customDelivery: 'Call\nahead',
      nearestPort: 'Poti',
      leadTimeDays: 14,
      isPublished: false,
    });
    expect(typeof body?.leadTimeDays).toBe('number');
    const hidden = draftRequestBody(
      'Tea',
      '',
      commercial({
        deliveryAvailable: false,
        incoterms: ['FOB'],
        carriers: ['DHL'],
        customDelivery: 'Keep',
        nearestPort: 'Poti',
        leadTimeDays: '3',
        palletSize: 'euro',
      }),
    );
    expect(hidden).toMatchObject({ deliveryAvailable: false, palletSize: 'euro' });
    expect(hidden).not.toHaveProperty('incoterms');
    expect(hidden).not.toHaveProperty('customDelivery');
    expect(hidden).not.toHaveProperty('leadTimeDays');
    expect(draftIssue('Tea', '', commercial({ palletSize: 'p'.repeat(81) }))).toBe('palletTooLong');
    expect(draftIssue('Tea', '', commercial({ palletSize: 'p'.repeat(80) }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ packagingTypes: ['crate'] }))).toBe('packagingTypesInvalid');
    expect(draftIssue('Tea', '', commercial({ packagingWeightsText: Array.from({ length: 13 }, (_, i) => String(i + 1)).join(', ') }))).toBe(
      'packagingWeightsInvalid',
    );
    expect(
      draftIssue('Tea', '', commercial({ deliveryAvailable: true, customDelivery: 'c'.repeat(501) })),
    ).toBe('customDeliveryTooLong');
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, nearestPort: 'n'.repeat(121) }))).toBe(
      'nearestPortTooLong',
    );
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, nearestPort: 'n'.repeat(120) }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, leadTimeDays: '1.5' }))).toBe('leadTimeInvalid');
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, leadTimeDays: '366' }))).toBe('leadTimeInvalid');
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, leadTimeDays: '0' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, leadTimeDays: '365' }))).toBeNull();
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, incoterms: ['DDP'] }))).toBe('incotermsInvalid');
    expect(draftIssue('Tea', '', commercial({ deliveryAvailable: true, carriers: ['Maersk'] }))).toBe('carriersInvalid');
    expect(draftRequestBody('Tea', '', commercial({ deliveryAvailable: true, leadTimeDays: '0' }))?.leadTimeDays).toBe(0);
  });

  it('sends selected category and unit codes', () => {
    expect(draftRequestBody('Tea', '', commercial({ category: 'tea', unit: 'kg' }))).toMatchObject({
      category: 'tea',
      unit: 'kg',
      isPublished: false,
    });
  });

  it('accepts an integer price and a two-decimal price', () => {
    expect(parseDraftPrice('6')).toBe(6);
    expect(parseDraftPrice('6.5')).toBe(6.5);
    expect(parseDraftPrice('6.50')).toBe(6.5);
    expect(parseDraftPrice('3.50')).toBe(3.5);
    expect(parseDraftPrice('3,50')).toBe(3.5);
    expect(parseDraftPrice('12.75')).toBe(12.75);
    expect(parseDraftPrice('12,75')).toBe(12.75);
    expect(draftRequestBody('Tea', '', commercial({ price: '6.50', currency: 'GEL' }))).toMatchObject({
      priceFrom: 6.5,
      priceCurrency: 'GEL',
    });
    expect(draftRequestBody('Tea', '', commercial({ currency: 'EUR' }))?.priceCurrency).toBe('EUR');
    expect(draftRequestBody('Tea', '', commercial({ currency: 'USD' }))?.priceCurrency).toBe('USD');
  });

  it('rejects zero, negative, invalid, and over-precise prices without submitting', () => {
    expect(draftIssue('Tea', '', commercial({ price: '0' }))).toBe('priceInvalid');
    expect(draftIssue('Tea', '', commercial({ price: '0.00' }))).toBe('priceInvalid');
    expect(draftIssue('Tea', '', commercial({ price: '-1' }))).toBe('priceInvalid');
    expect(draftIssue('Tea', '', commercial({ price: '6.555' }))).toBe('priceInvalid');
    expect(draftIssue('Tea', '', commercial({ price: 'abc' }))).toBe('priceInvalid');
    expect(draftRequestBody('Tea', '', commercial({ price: '0' }))).toBeNull();
  });

  it('sends the two price flags independently and defaults them to false', () => {
    expect(draftRequestBody('Tea', '', commercial())).toMatchObject({
      priceNegotiable: false,
      priceDependsOnVolume: false,
    });
    expect(
      draftRequestBody('Tea', '', commercial({ priceNegotiable: true, priceDependsOnVolume: false })),
    ).toMatchObject({ priceNegotiable: true, priceDependsOnVolume: false });
    expect(
      draftRequestBody('Tea', '', commercial({ priceNegotiable: false, priceDependsOnVolume: true })),
    ).toMatchObject({ priceNegotiable: false, priceDependsOnVolume: true });
    expect(
      draftRequestBody('Tea', '', commercial({ priceNegotiable: true, priceDependsOnVolume: true })),
    ).toMatchObject({
      priceNegotiable: true,
      priceDependsOnVolume: true,
      isPublished: false,
    });
  });

  it('keeps commercial fields when saving fails', async () => {
    const entered = commercial({
      category: 'tea',
      unit: 'kg',
      price: '6.50',
      currency: 'GEL',
      priceNegotiable: true,
      priceDependsOnVolume: true,
    });
    const snapshot = { ...entered };
    const result = await submitProductDraft({
      title: 'Green tea',
      description: 'Fresh\nleaf',
      commercial: entered,
      gate: { pending: false },
      create: async () => {
        throw new ApiError({ message: 'Failed', status: 500, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(result.status).toBe('failed');
    expect(entered).toEqual(snapshot);
    expect(routeAfterDraft(result.status)).toBeNull();
  });
});
