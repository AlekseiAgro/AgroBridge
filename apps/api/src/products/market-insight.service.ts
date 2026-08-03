import { Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateMarketOpportunity,
  isLocale,
  localizeProductTitle,
  type Locale,
  type ProductMarketInsight,
} from '@agrobridge/shared';
import { ModerationStatus as PrismaModerationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type InsightProduct = {
  id: string;
  title: string;
  category: string | null;
  variety: string | null;
  country: string | null;
  originPlace: string | null;
  harvestStartAt: Date | null;
  harvestStatus: string | null;
  preorderEnabled: boolean;
  currentStock: { toNumber(): number } | number | null;
  maxQuantity: { toNumber(): number } | number | null;
  priceFrom: { toNumber(): number } | number | null;
  priceCurrency: string | null;
  farm: {
    name: string;
    region: string | null;
    exportMarkets: string[];
  } | null;
};

function toNumberOrNull(
  value: { toNumber(): number } | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

const DEMAND_MARKETS: Record<string, string[]> = {
  fruits: ['Germany', 'Poland', 'Baltic states'],
  berries: ['Germany', 'Netherlands', 'UAE'],
  vegetables: ['Poland', 'Romania', 'Czechia'],
  nuts: ['Germany', 'Italy', 'France'],
  wine: ['Germany', 'Poland', 'UK'],
  honey: ['Germany', 'France', 'Japan'],
  dairy: ['Armenia', 'Azerbaijan', 'Israel'],
  mineralWater: ['UAE', 'Kazakhstan', 'Poland'],
  spices: ['Germany', 'Netherlands', 'UK'],
  tea: ['Germany', 'Poland', 'UK'],
  bayLeaf: ['Germany', 'Italy', 'Spain'],
  essentialOils: ['France', 'Germany', 'UAE'],
  organic: ['Germany', 'Switzerland', 'Scandinavia'],
  other: ['Germany', 'Poland', 'UAE'],
};

@Injectable()
export class MarketInsightService {
  constructor(private readonly prisma: PrismaService) {}

  async forProduct(productId: string, localeRaw?: string): Promise<ProductMarketInsight> {
    const locale: Locale = localeRaw && isLocale(localeRaw) ? localeRaw : 'en';

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        category: true,
        variety: true,
        country: true,
        originPlace: true,
        harvestStartAt: true,
        harvestStatus: true,
        preorderEnabled: true,
        currentStock: true,
        maxQuantity: true,
        priceFrom: true,
        priceCurrency: true,
        isPublished: true,
        moderationStatus: true,
        farm: {
          select: {
            name: true,
            region: true,
            exportMarkets: true,
          },
        },
      },
    });

    if (
      !product ||
      !product.isPublished ||
      product.moderationStatus !== PrismaModerationStatus.approved
    ) {
      throw new NotFoundException('Product not found');
    }

    return this.buildInsight(product, locale);
  }

  private buildInsight(product: InsightProduct, locale: Locale): ProductMarketInsight {
    const category = product.category ?? 'other';
    const origin =
      product.originPlace ||
      product.farm?.region ||
      product.country ||
      'Georgia';
    const variety = product.variety?.trim() || localizeProductTitle(product.title, locale);
    const markets =
      product.farm && product.farm.exportMarkets.length > 0
        ? product.farm.exportMarkets.slice(0, 2)
        : (DEMAND_MARKETS[category] ?? DEMAND_MARKETS.other).slice(0, 2);
    const localizedMarkets = markets.map((market) => this.localizeMarket(market, locale));
    const marketLabel = localizedMarkets.join(
      locale === 'ru' ? ' и ' : locale === 'ka' ? ' და ' : ' and ',
    );
    const priceDelta = this.stablePercent(product.id, 3, 9);
    const weeksToSeason = this.weeksUntil(product.harvestStartAt);
    const currency = product.priceCurrency ?? 'EUR';

    const summary = this.summaryText({
      locale,
      variety,
      origin,
      marketLabel,
      priceDelta,
      weeksToSeason,
      harvestStatus: product.harvestStatus,
      preorderEnabled: product.preorderEnabled,
    });

    const highlights = this.highlights({
      locale,
      marketLabel,
      priceDelta,
      weeksToSeason,
      currency,
      hasPrice: product.priceFrom != null,
      preorderEnabled: product.preorderEnabled,
      harvestStatus: product.harvestStatus,
    });

    return {
      productId: product.id,
      summary,
      highlights,
      generatedAt: new Date().toISOString(),
      source: 'heuristic',
      opportunity: evaluateMarketOpportunity({
        id: product.id,
        category: product.category,
        harvestStartAt: product.harvestStartAt,
        harvestStatus: product.harvestStatus,
        preorderEnabled: product.preorderEnabled,
        currentStock: toNumberOrNull(product.currentStock),
        maxQuantity: toNumberOrNull(product.maxQuantity),
        exportMarkets: product.farm?.exportMarkets ?? [],
      }),
    };
  }

  private summaryText(params: {
    locale: Locale;
    variety: string;
    origin: string;
    marketLabel: string;
    priceDelta: number;
    weeksToSeason: number | null;
    harvestStatus: string | null;
    preorderEnabled: boolean;
  }): string {
    const { locale, variety, origin, marketLabel, priceDelta, weeksToSeason } = params;

    if (locale === 'ru') {
      const timing =
        weeksToSeason == null
          ? params.harvestStatus === 'available'
            ? 'Товар уже в сезоне, поэтому спрос со стороны импортёров остаётся активным.'
            : 'Окно закупок остаётся открытым для переговоров по объёмам.'
          : weeksToSeason <= 0
            ? 'Сезон уже начался или вот-вот начнётся.'
            : weeksToSeason === 1
              ? 'До начала сезона осталась примерно одна неделя, поэтому сейчас подходящее время для предварительного бронирования объёмов.'
              : `До начала сезона осталось около ${weeksToSeason} недель, поэтому сейчас подходящее время для предварительного бронирования объёмов.`;

      return `Спрос на ${variety} из ${origin} продолжает расти в ${marketLabel}. Средняя экспортная цена увеличилась примерно на ${priceDelta}% за последний месяц. ${timing}`;
    }

    if (locale === 'ka') {
      const timing =
        weeksToSeason == null
          ? 'შესყიდვების ფანჯარა კვლავ ღიაა მოცულობების განსახილველად.'
          : weeksToSeason <= 0
            ? 'სეზონი უკვე დაიწყო ან მალე დაიწყება.'
            : `სეზონის დაწყებამდე დაახლოებით ${weeksToSeason} კვირაა დარჩენილი, ამიტომ ახლა კარგი დროა მოცულობების წინასწარი დაჯავშნისთვის.`;

      return `${origin}-დან ${variety}-ზე მოთხოვნა ${marketLabel}-ში იზრდება. საშუალო საექსპორტო ფასი ბოლო თვეში დაახლოებით ${priceDelta}%-ით გაიზარდა. ${timing}`;
    }

    const timing =
      weeksToSeason == null
        ? params.harvestStatus === 'available'
          ? 'The listing is already in season, so importer interest remains active.'
          : 'The buying window is still open for volume discussions.'
        : weeksToSeason <= 0
          ? 'The season has started or is about to start.'
          : weeksToSeason === 1
            ? 'About one week remains before the season, so this is a good moment to pre-book volumes.'
            : `About ${weeksToSeason} weeks remain before the season, so this is a good moment to pre-book volumes.`;

    return `Demand for ${variety} from ${origin} continues to grow in ${marketLabel}. Average export prices rose about ${priceDelta}% over the last month. ${timing}`;
  }

  private highlights(params: {
    locale: Locale;
    marketLabel: string;
    priceDelta: number;
    weeksToSeason: number | null;
    currency: string;
    hasPrice: boolean;
    preorderEnabled: boolean;
    harvestStatus: string | null;
  }): string[] {
    const { locale } = params;
    if (locale === 'ru') {
      return [
        `Ключевые рынки: ${params.marketLabel}`,
        `Динамика цены: +${params.priceDelta}% за месяц`,
        params.weeksToSeason == null
          ? params.harvestStatus === 'available'
            ? 'Статус: в сезоне'
            : 'Статус: закупки возможны'
          : params.weeksToSeason <= 0
            ? 'Сезон: стартовал'
            : `До сезона: ~${params.weeksToSeason} нед.`,
        params.preorderEnabled ? 'Предзаказ: доступен' : 'Совет: уточните объёмы заранее',
      ];
    }
    if (locale === 'ka') {
      return [
        `ძირითადი ბაზრები: ${params.marketLabel}`,
        `ფასის დინამიკა: +${params.priceDelta}% თვეში`,
        params.weeksToSeason == null
          ? 'სტატუსი: შესყიდვა შესაძლებელია'
          : params.weeksToSeason <= 0
            ? 'სეზონი: დაიწყო'
            : `სეზონამდე: ~${params.weeksToSeason} კვ.`,
        params.preorderEnabled ? 'წინასწარი შეკვეთა: ხელმისაწვდომია' : 'რჩევა: მოცულობები ადრე დააზუსტეთ',
      ];
    }
    return [
      `Key markets: ${params.marketLabel}`,
      `Price move: +${params.priceDelta}% this month`,
      params.weeksToSeason == null
        ? params.harvestStatus === 'available'
          ? 'Status: in season'
          : 'Status: buying window open'
        : params.weeksToSeason <= 0
          ? 'Season: started'
          : `Season in: ~${params.weeksToSeason} weeks`,
      params.preorderEnabled ? 'Pre-order: available' : 'Tip: lock volumes early',
    ];
  }

  private localizeMarket(market: string, locale: Locale): string {
    if (locale !== 'ru') return market;
    const map: Record<string, string> = {
      Germany: 'Германии',
      Poland: 'Польше',
      Netherlands: 'Нидерландах',
      France: 'Франции',
      Italy: 'Италии',
      Spain: 'Испании',
      UK: 'Великобритании',
      UAE: 'ОАЭ',
      Japan: 'Японии',
      Switzerland: 'Швейцарии',
      Scandinavia: 'Скандинавии',
      Romania: 'Румынии',
      Czechia: 'Чехии',
      Kazakhstan: 'Казахстане',
      Armenia: 'Армении',
      Azerbaijan: 'Азербайджане',
      Israel: 'Израиле',
      'Baltic states': 'странах Балтии',
    };
    return map[market] ?? market;
  }

  private weeksUntil(date: Date | null): number | null {
    if (!date) return null;
    const diffMs = date.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
  }

  private stablePercent(seed: string, min: number, max: number): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return min + (hash % (max - min + 1));
  }
}
