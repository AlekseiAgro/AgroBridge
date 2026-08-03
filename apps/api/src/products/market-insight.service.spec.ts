import { NotFoundException } from '@nestjs/common';
import { MarketInsightService } from './market-insight.service';

describe('MarketInsightService', () => {
  const prisma = {
    product: {
      findUnique: jest.fn(),
    },
  };

  let service: MarketInsightService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketInsightService(prisma as never);
  });

  it('returns a localized insight for a public product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'White Seedless Grapes',
      category: 'fruits',
      variety: 'Superior',
      country: 'Georgia',
      originPlace: 'Kakheti',
      harvestStartAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      harvestStatus: 'growing',
      preorderEnabled: true,
      priceFrom: 0.85,
      priceCurrency: 'EUR',
      isPublished: true,
      moderationStatus: 'approved',
      farm: {
        name: 'Kakheti Vineyard',
        region: 'kakheti',
        exportMarkets: ['Germany', 'Poland'],
      },
    });

    const insight = await service.forProduct('p1', 'ru');
    expect(insight.productId).toBe('p1');
    expect(insight.source).toBe('heuristic');
    expect(insight.summary).toContain('Superior');
    expect(insight.summary).toContain('Германии');
    expect(insight.highlights.length).toBeGreaterThan(0);
  });

  it('rejects unpublished products', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.forProduct('missing', 'en')).rejects.toBeInstanceOf(NotFoundException);
  });
});
