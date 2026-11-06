import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import {
  createProductDraft,
  getSellerProduct,
  listMyProducts,
  updateSellerHarvestStatus,
  updateSellerProduct,
} from './products-api';

const BASE = 'https://api.agrobridge.ge/api';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function client(fetchImpl: typeof fetch, onUnauthorized: () => void = () => undefined) {
  return new ApiClient({
    baseUrl: BASE,
    getAccessToken: async () => 'jwt-1',
    onUnauthorized,
    fetchImpl,
  });
}

const row = {
  id: 'p1',
  title: 'Green tea',
  priceFrom: 6,
  priceCurrency: 'GEL',
  unit: 'kg',
  isPublished: true,
  moderationStatus: 'approved',
  moderationNote: null,
  harvestStatus: 'available',
  images: [{ url: 'https://media.agrobridge.ge/products/p1/a.jpg', isPrimary: true, sortOrder: 0 }],
};

describe('updateSellerHarvestStatus', () => {
  it.each([
    [null, null],
    ['growing', 'growing'],
    ['available', 'available'],
    ['limited', 'limited'],
    ['soldOut', 'soldOut'],
  ] as const)('patches only harvestStatus %s', async (harvestStatus, expected) => {
    let body = '';
    let method = '';
    const api = client(async (_input, init) => {
      method = init?.method ?? '';
      body = String(init?.body ?? '');
      return json(200, { ...row, harvestStatus, viewCount: 9, watchCount: 2 });
    });
    const product = await updateSellerHarvestStatus(api, 'p1', { harvestStatus });
    expect(method).toBe('PATCH');
    expect(JSON.parse(body)).toEqual({ harvestStatus });
    expect(product.harvestStatus).toBe(expected);
    expect(product.isPublished).toBe(true);
    expect(product.title).toBe('Green tea');
    expect(product.viewCount).toBe(9);
    expect(product.watchCount).toBe(2);
  });
});

describe('listMyProducts', () => {
  it('loads GET /products/mine with the bearer token', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    const api = client(async (input, init) => {
      method = init?.method ?? 'GET';
      url = String(input);
      const headers = init?.headers as Record<string, string>;
      authorization = headers.Authorization ?? '';
      return json(200, [{ ...row, viewCount: 124, watchCount: 8 }]);
    });

    const products = await listMyProducts(api);

    expect(method).toBe('GET');
    expect(url).toBe(`${BASE}/products/mine`);
    expect(authorization).toBe('Bearer jwt-1');
    expect(products).toEqual([
      {
        id: 'p1',
        title: 'Green tea',
        priceFrom: 6,
        priceCurrency: 'GEL',
        unit: 'kg',
        isPublished: true,
        moderationStatus: 'approved',
        moderationNote: null,
        harvestStatus: 'available',
        images: [{ url: 'https://media.agrobridge.ge/products/p1/a.jpg', isPrimary: true, sortOrder: 0 }],
        viewCount: 124,
        watchCount: 8,
      },
    ]);
  });

  it('accepts an empty list', async () => {
    const api = client(async () => json(200, []));
    await expect(listMyProducts(api)).resolves.toEqual([]);
  });

  it('surfaces API, unauthorized, and forbidden failures', async () => {
    const unauthorized = jest.fn();
    const denied = client(async () => json(401, { message: 'Unauthorized' }), unauthorized);
    await expect(listMyProducts(denied)).rejects.toBeInstanceOf(ApiError);
    await expect(listMyProducts(denied)).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalled();

    const forbidden = client(async () => json(403, { message: 'Confirm your email address to access your account' }));
    await expect(listMyProducts(forbidden)).rejects.toMatchObject({ status: 403 });

    const down = client(async () => {
      throw new TypeError('network');
    });
    await expect(listMyProducts(down)).rejects.toMatchObject({ kind: 'network' });

    const failed = client(async () => json(500, { message: 'Failed' }));
    await expect(listMyProducts(failed)).rejects.toMatchObject({ status: 500 });
  });
});

describe('createProductDraft', () => {
  it('posts an unpublished draft and does not send server-owned fields', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    let payload: Record<string, unknown> | null = null;
    const api = client(async (input, init) => {
      method = init?.method ?? 'GET';
      url = String(input);
      const headers = init?.headers as Record<string, string>;
      authorization = headers.Authorization ?? '';
      payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      return json(201, {
        id: 'p-new',
        title: 'Green tea',
        description: 'Fresh\nleaf',
        isPublished: false,
        moderationStatus: 'draft',
        moderationNote: null,
        images: [],
      });
    });

    const product = await createProductDraft(api, {
      title: 'Green tea',
      description: 'Fresh\nleaf',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      preorderEnabled: false,
      deliveryAvailable: false,
      isPublished: false,
    });

    expect(method).toBe('POST');
    expect(url).toBe(`${BASE}/products`);
    expect(authorization).toBe('Bearer jwt-1');
    expect(payload).toEqual({
      title: 'Green tea',
      description: 'Fresh\nleaf',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      preorderEnabled: false,
      deliveryAvailable: false,
      isPublished: false,
    });
    expect(payload).not.toHaveProperty('farmId');
    expect(payload).not.toHaveProperty('ownerUserId');
    expect(payload).not.toHaveProperty('sourceLocale');
    expect(payload).not.toHaveProperty('moderationStatus');
    expect(payload).not.toHaveProperty('moderationNote');
    expect(product).toMatchObject({ id: 'p-new', title: 'Green tea', isPublished: false, moderationStatus: 'draft' });
  });

  it('rejects unauthorized, forbidden, validation, and rate-limit responses', async () => {
    const unauthorized = jest.fn();
    const denied = client(async () => json(401, { message: 'Unauthorized' }), unauthorized);
    await expect(
      createProductDraft(denied, { title: 'Tea', priceNegotiable: false, priceDependsOnVolume: false, preorderEnabled: false, deliveryAvailable: false, isPublished: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalled();

    const forbidden = client(async () => json(403, { message: 'Confirm your email address to access your account' }));
    await expect(createProductDraft(forbidden, { title: 'Tea', priceNegotiable: false, priceDependsOnVolume: false, preorderEnabled: false, deliveryAvailable: false, isPublished: false })).rejects.toMatchObject({
      status: 403,
    });

    const invalid = client(async () => json(400, { message: ['title must be longer than or equal to 2 characters'] }));
    await expect(createProductDraft(invalid, { title: 'Tea', priceNegotiable: false, priceDependsOnVolume: false, preorderEnabled: false, deliveryAvailable: false, isPublished: false })).rejects.toMatchObject({
      status: 400,
    });

    const limited = client(async () =>
      json(429, { message: 'Too many attempts. Try again later.', retryAfterSeconds: 30 }),
    );
    await expect(createProductDraft(limited, { title: 'Tea', priceNegotiable: false, priceDependsOnVolume: false, preorderEnabled: false, deliveryAvailable: false, isPublished: false })).rejects.toMatchObject({
      status: 429,
      kind: 'http',
    });

    const down = client(async () => {
      throw new TypeError('network');
    });
    await expect(createProductDraft(down, { title: 'Tea', priceNegotiable: false, priceDependsOnVolume: false, preorderEnabled: false, deliveryAvailable: false, isPublished: false })).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

const detail = {
  id: 'p1',
  isOwner: true,
  title: 'Tea',
  description: 'Leaf',
  source: { title: 'ჩაი', description: 'ფოთოლი' },
  display: { title: 'Tea', description: 'Leaf' },
  category: 'tea',
  unit: 'kg',
  priceFrom: 6.5,
  priceCurrency: 'GEL',
  priceNegotiable: true,
  priceDependsOnVolume: false,
  isPublished: false,
  moderationStatus: 'draft',
  moderationNote: null,
};

describe('seller product editor API', () => {
  it('loads the owned product with GET /products/:id', async () => {
    let url = '';
    let authorization = '';
    const api = client(async (input, init) => {
      url = String(input);
      authorization = (init?.headers as Record<string, string>).Authorization ?? '';
      return json(200, detail);
    });
    const product = await getSellerProduct(api, 'p1');
    expect(url).toBe(`${BASE}/products/p1`);
    expect(authorization).toBe('Bearer jwt-1');
    expect(product.title).toBe('ჩაი');
    expect(product.description).toBe('ფოთოლი');
  });

  it('maps 401, 403, and 404 and hides another seller product', async () => {
    const unauthorized = jest.fn();
    await expect(
      getSellerProduct(client(async () => json(401, { message: 'Unauthorized' }), unauthorized), 'p1'),
    ).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalled();
    await expect(
      getSellerProduct(client(async () => json(403, { message: 'Forbidden' })), 'p1'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      getSellerProduct(client(async () => json(404, { message: 'Product not found' })), 'p1'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getSellerProduct(client(async () => json(200, { ...detail, isOwner: false })), 'p1'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('patches the seller payload and keeps server-owned fields out', async () => {
    let payload: Record<string, unknown> | null = null;
    const api = client(async (_input, init) => {
      payload = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      return json(200, { ...detail, isPublished: true, moderationStatus: 'approved' });
    });
    const body = {
      title: 'Green tea',
      description: 'Leaf',
      category: 'tea',
      unit: 'kg',
      priceFrom: 6.5,
      priceCurrency: 'GEL',
      variety: 'Kolkhuri',
      country: 'Georgia',
      originPlace: 'Kakheti',
      minQuantity: 1,
      maxQuantity: 10,
      currentStock: 4,
      monthlyProduction: 20,
      maxAnnualProduction: 200,
      priceNegotiable: true,
      priceDependsOnVolume: false,
      seasonMonths: [6, 7],
      harvestStartAt: '2026-06-01',
      harvestEndAt: '2026-09-30',
      forecastQuantity: 12.5,
      harvestStatus: 'growing',
      preorderEnabled: true,
      packagingTypes: ['carton', 'bag'],
      packagingWeights: ['5 kg', '10 kg'],
      palletSize: '80x120',
      deliveryAvailable: true,
      incoterms: ['FOB', 'EXW'],
      carriers: ['DHL', 'other'],
      customDelivery: 'Call ahead',
      nearestPort: 'Poti',
      leadTimeDays: 14,
      isPublished: true,
    };
    const product = await updateSellerProduct(api, 'p1', body);
    expect(payload).toEqual(body);
    expect(payload).not.toHaveProperty('farmId');
    expect(payload).not.toHaveProperty('ownerUserId');
    expect(payload).not.toHaveProperty('sourceLocale');
    expect(payload).not.toHaveProperty('moderationStatus');
    expect(payload).not.toHaveProperty('moderationNote');
    expect(product.moderationStatus).toBe('approved');
  });

  it('rejects a failed patch', async () => {
    await expect(
      updateSellerProduct(
        client(async () => json(400, { message: 'Published listings require a real title' })),
        'p1',
        {
          title: 'Tea',
          description: '',
          category: null,
          variety: null,
          country: null,
          originPlace: null,
          unit: null,
          minQuantity: null,
          maxQuantity: null,
          currentStock: null,
          monthlyProduction: null,
          maxAnnualProduction: null,
          priceFrom: null,
          priceCurrency: null,
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
          isPublished: true,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
