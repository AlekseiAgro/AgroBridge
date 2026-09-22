import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateMarketOpportunity } from '@agrobridge/shared';
import { NotFoundException } from '@nestjs/common';
import { MarketInsightService } from './market-insight.service';

const MESSAGES_DIR = join(__dirname, '../../../web/messages');
const LOCALES = ['en', 'ru', 'ka', 'de', 'fr', 'it', 'es'] as const;
const WEB_SRC = join(__dirname, '../../../web/src');

const FORBIDDEN_UI = [
  'AI Market Insight',
  'High demand',
  'price growth is expected soon',
  'Price growth expected',
  'average export prices rose',
  'Price move',
  'Recent price move',
  'Высокий спрос',
  'рост цен',
  'экспортная цена увеличилась',
  'Динамика цены',
  'მაღალი მოთხოვნა',
  'ფასების ზრდა',
  'Hohe Nachfrage',
  'Preisanstieg',
  'Forte demande',
  'Hausse des prix',
  'Alta domanda',
  'Aumento dei prezzi previsto',
  'Alta demanda',
  'aumento de precios',
];

function messages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    marketInsight: Record<string, string>;
    opportunity: {
      tiers: Record<string, string>;
      tooltip: Record<string, string>;
    };
  };
}

function publicProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'White Seedless Grapes',
    category: 'fruits',
    variety: 'Superior',
    country: 'Georgia',
    originPlace: 'Kakheti',
    harvestStartAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    harvestStatus: 'growing',
    preorderEnabled: true,
    currentStock: 120,
    maxQuantity: 500,
    priceFrom: 0.85,
    priceCurrency: 'EUR',
    isPublished: true,
    moderationStatus: 'approved',
    farm: {
      name: 'Kakheti Vineyard',
      region: 'kakheti',
      exportMarkets: ['Germany', 'Poland'],
    },
    ...overrides,
  };
}

describe('evaluateMarketOpportunity', () => {
  it('still scores limited seasonal listings as excellent', () => {
    const opportunity = evaluateMarketOpportunity({
      id: 'berry-1',
      category: 'berries',
      harvestStartAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      harvestStatus: 'limited',
      preorderEnabled: true,
      exportMarkets: ['Germany', 'Netherlands'],
    });

    expect(opportunity.tier).toBe('excellent');
    expect(opportunity.highDemand).toBe(true);
    expect(opportunity.limitedSupply).toBe(true);
    expect(opportunity.priceRiseLikely).toBe(true);
    expect(opportunity.markets).toEqual(['Germany', 'Netherlands']);
    expect(opportunity.weeksToSeason).toBe(3);
  });
});

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

  it('returns a localized listing signal for a public product', async () => {
    prisma.product.findUnique.mockResolvedValue(publicProduct());

    const insight = await service.forProduct('p1', 'ru');
    expect(insight.productId).toBe('p1');
    expect(insight.source).toBe('heuristic');
    expect(insight.summary).toContain('Superior');
    expect(insight.summary).toContain('Германия');
    expect(insight.summary).toMatch(/сигнал/i);
    expect(insight.highlights.some((item) => item.includes('Экспортные рынки'))).toBe(true);
    expect(insight.highlights.some((item) => item.includes('Цена в карточке: 0.85 EUR'))).toBe(true);
    expect(insight.highlights.some((item) => /сезон/i.test(item))).toBe(true);
    expect(insight.opportunity.tier).toBeTruthy();
    expect(insight.opportunity.markets).toEqual(['Germany', 'Poland']);
  });

  it('falls back to GEL only when the stored product currency is missing', async () => {
    prisma.product.findUnique.mockResolvedValue(publicProduct({ priceCurrency: null }));
    const missing = await service.forProduct('p1', 'en');
    expect(missing.highlights.some((item) => item.includes('Listed price: 0.85 GEL'))).toBe(true);
    expect(missing.highlights.some((item) => item.includes('EUR'))).toBe(false);

    prisma.product.findUnique.mockResolvedValue(publicProduct({ priceCurrency: 'EUR' }));
    const euro = await service.forProduct('p1', 'en');
    expect(euro.highlights.some((item) => item.includes('Listed price: 0.85 EUR'))).toBe(true);

    prisma.product.findUnique.mockResolvedValue(publicProduct({ priceCurrency: 'USD' }));
    const usd = await service.forProduct('p1', 'en');
    expect(usd.highlights.some((item) => item.includes('Listed price: 0.85 USD'))).toBe(true);
  });

  it('does not invent price movement in any locale', async () => {
    prisma.product.findUnique.mockResolvedValue(publicProduct());

    for (const locale of LOCALES) {
      const insight = await service.forProduct('p1', locale);
      const blob = `${insight.summary}\n${insight.highlights.join('\n')}`;
      expect(insight.source).toBe('heuristic');
      expect(blob).not.toMatch(/\+\d+%/);
      expect(blob.toLowerCase()).not.toContain('last month');
      expect(blob.toLowerCase()).not.toContain('price growth');
      expect(blob.toLowerCase()).not.toContain('average export');
      expect(blob.toLowerCase()).not.toContain('price move');
      expect(blob).not.toContain('Динамика цены');
      expect(blob).not.toContain('ფასის დინამიკა');
      expect(blob).toMatch(/Kakheti|Кахети|კახეთი|Superior/);
      expect(insight.highlights.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('rejects unpublished, unapproved, and internal draft titles', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.forProduct('missing', 'en')).rejects.toBeInstanceOf(NotFoundException);

    prisma.product.findUnique.mockResolvedValue(
      publicProduct({ isPublished: false, moderationStatus: 'approved' }),
    );
    await expect(service.forProduct('p1', 'en')).rejects.toBeInstanceOf(NotFoundException);

    prisma.product.findUnique.mockResolvedValue(
      publicProduct({ isPublished: true, moderationStatus: 'pending' }),
    );
    await expect(service.forProduct('p1', 'en')).rejects.toBeInstanceOf(NotFoundException);

    prisma.product.findUnique.mockResolvedValue(
      publicProduct({ title: 'Новый товар', isPublished: true, moderationStatus: 'approved' }),
    );
    await expect(service.forProduct('p1', 'en')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('honest Market Insight copy', () => {
  it('removes AI and unsupported price-growth claims from all seven locales', () => {
    const requiredInsight = ['button', 'title', 'close', 'loading', 'error', 'disclaimer'] as const;
    const requiredTooltip = [
      'signalBasis',
      'exportMarkets',
      'exportMarketsUnknown',
      'limitedSupply',
      'availableSupply',
      'seasonOneWeek',
      'seasonWeeks',
      'seasonStarted',
      'seasonUnstated',
    ] as const;

    for (const locale of LOCALES) {
      const catalog = messages(locale);
      for (const key of requiredInsight) {
        expect(catalog.marketInsight[key].trim().length).toBeGreaterThan(0);
      }
      for (const key of ['excellent', 'good', 'fair', 'watch'] as const) {
        expect(catalog.opportunity.tiers[key].trim().length).toBeGreaterThan(0);
      }
      for (const key of requiredTooltip) {
        expect(catalog.opportunity.tooltip[key].trim().length).toBeGreaterThan(0);
      }

      const blob = JSON.stringify(catalog.marketInsight) + JSON.stringify(catalog.opportunity);
      for (const phrase of FORBIDDEN_UI) {
        expect(blob.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
      expect(catalog.marketInsight.button.toLowerCase()).not.toContain('ai');
      expect(catalog.marketInsight.disclaimer.length).toBeGreaterThan(40);
      expect(catalog.opportunity.tooltip.exportMarkets).toContain('{markets}');
      expect(catalog.opportunity.tooltip.seasonWeeks).toContain('{weeks}');
    }
  });

  it('keeps de/fr/it/es Market Insight chrome localized', () => {
    expect(messages('de').marketInsight.button).toBe('Marktsignal');
    expect(messages('fr').marketInsight.button).toBe('Signal de marché');
    expect(messages('it').marketInsight.button).toBe('Segnale di mercato');
    expect(messages('es').marketInsight.button).toBe('Señal de mercado');
    expect(messages('de').marketInsight.title).not.toBe('Market Insight');
    expect(messages('fr').marketInsight.close).toBe('Fermer');
    expect(messages('it').marketInsight.close).toBe('Chiudi');
    expect(messages('es').marketInsight.close).toBe('Cerrar');
  });

  it('does not render former demand or price-growth keys in the badge', () => {
    const badge = readFileSync(join(WEB_SRC, 'components/MarketOpportunityBadge.tsx'), 'utf8');
    expect(badge).toContain("t('tooltip.exportMarkets'");
    expect(badge).toContain("t('tooltip.signalBasis')");
    expect(badge).not.toContain('highDemand');
    expect(badge).not.toContain('priceRise');
    expect(badge).not.toContain('priceStable');
    expect(badge).not.toContain('priceDeltaPercent');
  });
});
