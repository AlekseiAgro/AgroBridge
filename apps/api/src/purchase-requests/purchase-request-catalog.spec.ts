import { PurchaseRequestsService } from './purchase-requests.service';

describe('PurchaseRequestsService multilingual catalog', () => {
  const request = {
    id: 'r1',
    buyerId: 'b1',
    title: 'ყურძენი',
    category: 'fruits',
    quantity: '10',
    unit: 'kg',
    variety: null,
    packaging: null,
    destinationCountry: null,
    message: null,
    status: 'open',
    sourceLocale: 'ka',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    buyer: { id: 'b1', displayName: 'Nino', email: 'nino@example.com', locale: 'ka' },
    quotes: [],
    translations: [
      { locale: 'ru', status: 'completed', title: 'виноград' },
      { locale: 'en', status: 'completed', title: 'grapes' },
      { locale: 'de', status: 'completed', title: 'Trauben' },
      { locale: 'fr', status: 'completed', title: 'raisin' },
    ],
  };

  const prisma = {
    purchaseRequest: {
      findMany: jest.fn(),
    },
  };

  const service = new PurchaseRequestsService(
    prisma as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    prisma.purchaseRequest.findMany.mockResolvedValue([request]);
  });

  it('finds a request from original text and completed translations', async () => {
    for (const q of ['виноград', 'grapes', 'Trauben', 'raisin', 'ყურძენი']) {
      const items = await service.listOpen({ q, locale: 'ru' }, null);
      expect(items.map((item) => item.id)).toEqual(['r1']);
      expect(items[0]?.title).toBe('ყურძენი');
      expect(items[0]?.display?.title).toBe('виноград');
      expect(items[0]?.source?.title).toBe('ყურძენი');
    }
  });

  it('folds ё and е for purchase-request search', async () => {
    prisma.purchaseRequest.findMany.mockResolvedValue([
      {
        ...request,
        title: 'Гречишный мёд',
        sourceLocale: 'ru',
        translations: [],
      },
    ]);
    for (const q of ['мед', 'мёд', 'МЕД', 'МЁД']) {
      const items = await service.listOpen({ q }, null);
      expect(items).toHaveLength(1);
    }
  });

  it('falls back to the original request title when the translation is missing', async () => {
    const items = await service.listOpen({ locale: 'it' }, null);
    expect(items[0]?.display?.title).toBe('ყურძენი');
    expect(items[0]?.display?.translationStatus).toBe('pending');
    expect(items[0]?.title).toBe('ყურძენი');
  });
});
