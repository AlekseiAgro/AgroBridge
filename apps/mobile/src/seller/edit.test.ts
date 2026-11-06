import { ApiError } from '../api/errors';
import type { DraftGate } from './draft';
import {
  editBodyHasForbiddenField,
  editIssue,
  editKeepsPublished,
  editLoadFailure,
  editPhase,
  editRejectionNote,
  editRequestBody,
  parseSellerProductDetail,
  routeAfterEdit,
  sellerFormFromDetail,
  submitProductEdit,
  type SellerProductDetail,
} from './edit';
import { sellerEditDestination, sellerProductDestination, type SellerProduct } from './products';

function detail(overrides: Partial<SellerProductDetail> = {}): SellerProductDetail {
  return {
    id: 'p1',
    title: 'Green tea',
    description: 'Fresh\nleaf',
    category: 'tea',
    variety: '',
    country: 'Georgia',
    originPlace: '',
    unit: 'kg',
    minQuantity: null,
    maxQuantity: null,
    currentStock: null,
    monthlyProduction: null,
    maxAnnualProduction: null,
    priceFrom: 6.5,
    priceCurrency: 'GEL',
    priceNegotiable: true,
    priceDependsOnVolume: false,
    seasonMonths: [],
    harvestStartAt: '',
    harvestEndAt: '',
    forecastQuantity: null,
    harvestStatus: null,
    preorderEnabled: false,
    packagingTypes: [],
    packagingWeights: [],
    palletSize: '',
    deliveryAvailable: false,
    incoterms: [],
    carriers: [],
    customDelivery: '',
    nearestPort: '',
    leadTimeDays: null,
    images: [],
    videos: [],
    certificates: [],
    isPublished: false,
    moderationStatus: 'draft',
    moderationNote: null,
    ...overrides,
  };
}

describe('seller product editor', () => {
  it('fills the form from source text and ignores display translations', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: 'Translated',
      source: { title: 'ჩაი', description: 'ფოთოლი\nმწვანე' },
      display: { title: 'Tea', description: 'Green leaf' },
      category: 'tea',
      unit: 'kg',
      priceFrom: 6.5,
      priceCurrency: 'EUR',
      priceNegotiable: true,
      priceDependsOnVolume: true,
      isPublished: true,
      moderationStatus: 'approved',
      moderationNote: null,
    });
    expect(product?.title).toBe('ჩაი');
    expect(product?.description).toBe('ფოთოლი\nმწვანე');
    const form = sellerFormFromDetail(product!);
    expect(form).toMatchObject({
      title: 'ჩაი',
      description: 'ფოთოლი\nმწვანე',
      category: 'tea',
      unit: 'kg',
      unitTouched: true,
      price: '6.5',
      currency: 'EUR',
      priceNegotiable: true,
      priceDependsOnVolume: true,
    });
  });

  it('loads source variety, country, and origin place and ignores display text', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: null,
      variety: 'Display variety',
      country: null,
      originPlace: 'Display place',
      source: { variety: '  Kolkhuri  green ', originPlace: 'Kakheti  region', title: 'Tea', description: null },
      display: { variety: 'Translated variety', originPlace: 'Translated place', country: 'Georgia' },
      isPublished: false,
      moderationStatus: 'draft',
      moderationNote: null,
    });
    expect(product?.variety).toBe('Kolkhuri  green');
    expect(product?.originPlace).toBe('Kakheti  region');
    expect(product?.country).toBe('');
    const form = sellerFormFromDetail(product!);
    expect(form.variety).toBe('Kolkhuri  green');
    expect(form.originPlace).toBe('Kakheti  region');
    expect(form.country).toBe('');
    expect(form.country).not.toBe('Georgia');
  });

  it('keeps optional commercial fields empty for a title-only draft', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: null,
      category: null,
      unit: null,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: false,
      moderationStatus: 'draft',
      moderationNote: null,
    });
    const form = sellerFormFromDetail(product!);
    expect(form.description).toBe('');
    expect(form.category).toBeNull();
    expect(form.unit).toBeNull();
    expect(form.unitTouched).toBe(false);
    expect(form.price).toBe('');
    expect(form.currency).toBeNull();
    expect(editRequestBody(form, product!)).toEqual({
      title: 'Tea',
      description: '',
      category: null,
      unit: null,
      priceFrom: null,
      priceCurrency: null,
      variety: null,
      country: null,
      originPlace: null,
      minQuantity: null,
      maxQuantity: null,
      currentStock: null,
      monthlyProduction: null,
      maxAnnualProduction: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      seasonMonths: [],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: null,
      harvestStatus: null,
      preorderEnabled: false,
      packagingTypes: [],
      packagingWeights: [],
      palletSize: null,
      deliveryAvailable: false,
      incoterms: [],
      carriers: [],
      customDelivery: null,
      nearestPort: null,
      leadTimeDays: null,
      isPublished: false,
    });
  });

  it('clears variety, country, and origin place with null and keeps publication', () => {
    const published = detail({
      isPublished: true,
      moderationStatus: 'approved',
      variety: 'Kolkhuri',
      country: 'Georgia',
      originPlace: 'Kakheti',
    });
    const cleared = {
      ...sellerFormFromDetail(published),
      variety: '   ',
      country: '',
      originPlace: '  ',
    };
    expect(editRequestBody(cleared, published)).toMatchObject({
      variety: null,
      country: null,
      originPlace: null,
      isPublished: true,
    });
    const draft = detail({ isPublished: false, moderationStatus: 'draft' });
    expect(editRequestBody(sellerFormFromDetail(draft), draft)?.isPublished).toBe(false);
  });

  it('loads stored quantities and sends null when they are cleared', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: null,
      category: 'tea',
      unit: 'kg',
      minQuantity: 0.5,
      maxQuantity: 12,
      currentStock: 3.5,
      monthlyProduction: 10.25,
      maxAnnualProduction: 100,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: true,
      moderationStatus: 'approved',
      moderationNote: null,
    });
    const form = sellerFormFromDetail(product!);
    expect(form).toMatchObject({
      minQuantity: '0.5',
      maxQuantity: '12',
      currentStock: '3.5',
      monthlyProduction: '10.25',
      maxAnnualProduction: '100',
    });
    expect(
      editRequestBody(
        { ...form, minQuantity: '', currentStock: '8' },
        product!,
      ),
    ).toMatchObject({
      minQuantity: null,
      maxQuantity: 12,
      currentStock: 8,
      monthlyProduction: 10.25,
      maxAnnualProduction: 100,
      isPublished: true,
    });
    const pending = detail({ isPublished: true, moderationStatus: 'pending' });
    expect(editRequestBody(sellerFormFromDetail(pending), pending)?.isPublished).toBe(false);
    const comma = editRequestBody({ ...form, currentStock: '0,5', price: '12,75' }, product!);
    expect(comma?.currentStock).toBe(0.5);
    expect(comma?.priceFrom).toBe(12.75);
    expect(typeof comma?.currentStock).toBe('number');
    expect(typeof comma?.priceFrom).toBe('number');
    expect(comma?.isPublished).toBe(true);
  });

  it('loads harvest fields and clears them with null or an empty month list', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: null,
      category: 'tea',
      unit: 'kg',
      seasonMonths: [8, 6],
      harvestStartAt: '2026-06-01T00:00:00.000Z',
      harvestEndAt: '2026-08-31T00:00:00.000Z',
      forecastQuantity: 10.5,
      harvestStatus: 'limited',
      preorderEnabled: true,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: false,
      moderationStatus: 'draft',
      moderationNote: null,
    });
    const form = sellerFormFromDetail(product!);
    expect(form).toMatchObject({
      seasonMonths: [6, 8],
      harvestStartAt: '2026-06-01',
      harvestEndAt: '2026-08-31',
      forecastQuantity: '10.5',
      harvestStatus: 'limited',
      preorderEnabled: true,
    });
    expect(
      editRequestBody(
        {
          ...form,
          seasonMonths: [],
          harvestStartAt: '',
          harvestEndAt: '',
          forecastQuantity: '0,5',
          harvestStatus: null,
          preorderEnabled: false,
        },
        product!,
      ),
    ).toMatchObject({
      seasonMonths: [],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: 0.5,
      harvestStatus: null,
      preorderEnabled: false,
      isPublished: false,
    });
    const published = detail({ isPublished: true, moderationStatus: 'approved' });
    expect(editRequestBody(sellerFormFromDetail(published), published)?.isPublished).toBe(true);
  });

  it('loads packaging and delivery and clears logistics when delivery is off', () => {
    const product = parseSellerProductDetail({
      id: 'p1',
      isOwner: true,
      title: 'Tea',
      description: null,
      category: 'tea',
      unit: 'kg',
      packagingTypes: ['bag', 'carton'],
      packagingWeights: ['5 kg', '10 kg'],
      palletSize: '80x120',
      deliveryAvailable: true,
      incoterms: ['FOB'],
      carriers: ['DHL', 'other'],
      customDelivery: 'Call\nahead',
      nearestPort: 'Poti',
      leadTimeDays: 0,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: true,
      moderationStatus: 'approved',
      moderationNote: null,
    });
    const form = sellerFormFromDetail(product!);
    expect(form).toMatchObject({
      packagingTypes: ['bag', 'carton'],
      packagingWeightsText: '5 kg, 10 kg',
      palletSize: '80x120',
      deliveryAvailable: true,
      incoterms: ['FOB'],
      carriers: ['DHL', 'other'],
      customDelivery: 'Call\nahead',
      nearestPort: 'Poti',
      leadTimeDays: '0',
    });
    expect(editRequestBody({ ...form, palletSize: '   ', packagingWeightsText: '' }, product!)).toMatchObject({
      packagingTypes: ['bag', 'carton'],
      packagingWeights: [],
      palletSize: null,
      leadTimeDays: 0,
      isPublished: true,
    });
    expect(editRequestBody({ ...form, deliveryAvailable: false }, product!)).toMatchObject({
      deliveryAvailable: false,
      incoterms: [],
      carriers: [],
      customDelivery: null,
      nearestPort: null,
      leadTimeDays: null,
      palletSize: '80x120',
      isPublished: true,
    });
  });

  it('keeps an approved published product published and unpublishes every other save', () => {
    const published = detail({ isPublished: true, moderationStatus: 'approved' });
    const form = sellerFormFromDetail(published);
    expect(editKeepsPublished(published)).toBe(true);
    expect(editRequestBody(form, published)?.isPublished).toBe(true);
    expect(editRequestBody(form, detail({ isPublished: false, moderationStatus: 'draft' }))?.isPublished).toBe(false);
    expect(editRequestBody(form, detail({ isPublished: true, moderationStatus: 'pending' }))?.isPublished).toBe(false);
    expect(editRequestBody(form, detail({ isPublished: true, moderationStatus: 'rejected' }))?.isPublished).toBe(false);
    expect(editRequestBody(form, detail({ isPublished: false, moderationStatus: 'approved' }))?.isPublished).toBe(false);
  });

  it('shows a rejection note and no extra moderation action', () => {
    const rejected = detail({
      isPublished: true,
      moderationStatus: 'rejected',
      moderationNote: 'Photos are unclear',
    });
    expect(editRejectionNote(rejected)).toBe('Photos are unclear');
    expect(editRejectionNote(detail({ moderationStatus: 'pending', moderationNote: 'Photos are unclear' }))).toBeNull();
    const body = editRequestBody(sellerFormFromDetail(rejected), rejected);
    expect(body && editBodyHasForbiddenField(body)).toBe(false);
    expect(body).not.toHaveProperty('moderationStatus');
    expect(body).not.toHaveProperty('moderationNote');
  });

  it('opens product detail from the list and the editor from product detail', () => {
    const row = (moderationStatus: string, isPublished: boolean): SellerProduct => ({
      id: 'p1',
      title: 'Green tea',
      priceFrom: 6.5,
      priceCurrency: 'GEL',
      unit: 'kg',
      isPublished,
      moderationStatus,
      moderationNote: null,
      harvestStatus: null,
      images: [],
      viewCount: null,
      watchCount: null,
    });
    for (const product of [
      row('draft', false),
      row('pending', true),
      row('rejected', true),
      row('approved', true),
    ]) {
      expect(sellerProductDestination(product)).toEqual({
        screen: 'ProductDetail',
        params: { productId: 'p1', ownerPreview: true },
      });
      expect(sellerEditDestination(product)).toEqual({ screen: 'EditProduct', params: { productId: 'p1' } });
    }
  });

  it('preserves title, description, and price rules', () => {
    const loaded = detail();
    const form = sellerFormFromDetail(loaded);
    expect(editIssue({ ...form, title: ' ' }, loaded)).toBe('titleRequired');
    expect(editIssue({ ...form, title: 'A' }, loaded)).toBe('titleTooShort');
    expect(editIssue({ ...form, description: 'x'.repeat(4001) }, loaded)).toBe('descriptionTooLong');
    expect(editIssue({ ...form, price: '0' }, loaded)).toBe('priceInvalid');
    expect(editIssue({ ...form, price: '6.555' }, loaded)).toBe('priceInvalid');
    expect(editIssue({ ...form, price: '' }, detail())).toBeNull();
  });

  it('blocks a published save that newly drops a required commercial field', () => {
    const loaded = detail({ isPublished: true, moderationStatus: 'approved' });
    const form = { ...sellerFormFromDetail(loaded), category: null };
    expect(editIssue(form, loaded)).toBe('publishedIncomplete');
    expect(editRequestBody(form, loaded)).toBeNull();
  });

  it('stays on the editor when saving fails and returns to My Products after success', async () => {
    const loaded = detail();
    const form = sellerFormFromDetail(loaded);
    const gate: DraftGate = { pending: false };
    const snapshot = { ...form };
    const failed = await submitProductEdit({
      values: form,
      loaded,
      gate,
      update: async () => {
        throw new ApiError({ message: 'Failed', status: 500, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(failed.status).toBe('failed');
    expect(form).toEqual(snapshot);
    expect(routeAfterEdit(failed.status)).toBeNull();
    expect(gate.pending).toBe(false);

    const saved = await submitProductEdit({
      values: form,
      loaded,
      gate,
      update: async (body) => {
        expect(body.isPublished).toBe(false);
        expect(body.title).toBe('Green tea');
        return loaded;
      },
      onPending: () => undefined,
    });
    expect(saved.status).toBe('saved');
    expect(routeAfterEdit(saved.status)).toBe('MyProducts');
  });

  it('ignores a second save while the first is in flight', async () => {
    const gate: DraftGate = { pending: true };
    const update = jest.fn();
    const result = await submitProductEdit({
      values: sellerFormFromDetail(detail()),
      loaded: detail(),
      gate,
      update,
      onPending: () => undefined,
    });
    expect(result.status).toBe('ignored');
    expect(update).not.toHaveBeenCalled();
  });

  it('maps load failures and auth gates', () => {
    expect(editPhase({ authStatus: 'anonymous', user: null, profileUnavailable: false, loadStatus: 'idle' })).toBe(
      'signedOut',
    );
    expect(
      editPhase({
        authStatus: 'authenticated',
        user: { emailVerified: false },
        profileUnavailable: false,
        loadStatus: 'idle',
      }),
    ).toBe('unverified');
    expect(
      editPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'loading',
      }),
    ).toBe('loading');
    expect(
      editPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'notFound',
      }),
    ).toBe('notFound');
    expect(
      editPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'error',
      }),
    ).toBe('error');
    expect(editLoadFailure(new ApiError({ message: 'no', status: 404, kind: 'http' }))).toBe('notFound');
    expect(editLoadFailure(new ApiError({ message: 'no', status: 401, kind: 'http' }))).toBe('unauthorized');
    expect(editLoadFailure(new ApiError({ message: 'no', status: 403, kind: 'http' }))).toBe('forbidden');
    expect(editLoadFailure(new ApiError({ message: 'down', status: 0, kind: 'network' }))).toBe('network');
  });
});
