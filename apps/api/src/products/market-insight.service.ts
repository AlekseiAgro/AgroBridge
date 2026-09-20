import { Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateMarketOpportunity,
  isLocale,
  isPubliclyListedProduct,
  localizeProductTitle,
  type Locale,
  type ProductMarketInsight,
} from '@agrobridge/shared';
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

const CATEGORY_EXPORT_MARKETS: Record<string, string[]> = {
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

const MARKET_LABELS: Record<Locale, Record<string, string>> = {
  en: {},
  ru: {
    Germany: 'Германия',
    Poland: 'Польша',
    Netherlands: 'Нидерланды',
    France: 'Франция',
    Italy: 'Италия',
    Spain: 'Испания',
    UK: 'Великобритания',
    UAE: 'ОАЭ',
    Japan: 'Япония',
    Switzerland: 'Швейцария',
    Scandinavia: 'Скандинавия',
    Romania: 'Румыния',
    Czechia: 'Чехия',
    Kazakhstan: 'Казахстан',
    Armenia: 'Армения',
    Azerbaijan: 'Азербайджан',
    Israel: 'Израиль',
    'Baltic states': 'страны Балтии',
  },
  ka: {
    Germany: 'გერმანია',
    Netherlands: 'ნიდერლანდები',
    Poland: 'პოლონეთი',
    France: 'საფრანგეთი',
    Italy: 'იტალია',
    Spain: 'ესპანეთი',
    UK: 'გაერთიანებული სამეფო',
    UAE: 'არაბთა გაერთიანებული საამიროები',
    Japan: 'იაპონია',
    Switzerland: 'შვეიცარია',
    Scandinavia: 'სკანდინავია',
    Romania: 'რუმინეთი',
    Czechia: 'ჩეხეთი',
    Kazakhstan: 'ყაზახეთი',
    Armenia: 'სომხეთი',
    Azerbaijan: 'აზერბაიჯანი',
    Israel: 'ისრაელი',
    'Baltic states': 'ბალტიისპირეთის ქვეყნები',
  },
  de: {
    Germany: 'Deutschland',
    Netherlands: 'Niederlande',
    Poland: 'Polen',
    France: 'Frankreich',
    Italy: 'Italien',
    Spain: 'Spanien',
    UK: 'Großbritannien',
    UAE: 'VAE',
    Japan: 'Japan',
    Switzerland: 'Schweiz',
    Scandinavia: 'Skandinavien',
    Romania: 'Rumänien',
    Czechia: 'Tschechien',
    Kazakhstan: 'Kasachstan',
    Armenia: 'Armenien',
    Azerbaijan: 'Aserbaidschan',
    Israel: 'Israel',
    'Baltic states': 'baltische Staaten',
  },
  fr: {
    Germany: 'Allemagne',
    Netherlands: 'Pays-Bas',
    Poland: 'Pologne',
    France: 'France',
    Italy: 'Italie',
    Spain: 'Espagne',
    UK: 'Royaume-Uni',
    UAE: 'Émirats arabes unis',
    Japan: 'Japon',
    Switzerland: 'Suisse',
    Scandinavia: 'Scandinavie',
    Romania: 'Roumanie',
    Czechia: 'Tchéquie',
    Kazakhstan: 'Kazakhstan',
    Armenia: 'Arménie',
    Azerbaijan: 'Azerbaïdjan',
    Israel: 'Israël',
    'Baltic states': 'pays baltes',
  },
  it: {
    Germany: 'Germania',
    Netherlands: 'Paesi Bassi',
    Poland: 'Polonia',
    France: 'Francia',
    Italy: 'Italia',
    Spain: 'Spagna',
    UK: 'Regno Unito',
    UAE: 'Emirati Arabi Uniti',
    Japan: 'Giappone',
    Switzerland: 'Svizzera',
    Scandinavia: 'Scandinavia',
    Romania: 'Romania',
    Czechia: 'Cechia',
    Kazakhstan: 'Kazakistan',
    Armenia: 'Armenia',
    Azerbaijan: 'Azerbaigian',
    Israel: 'Israele',
    'Baltic states': 'Paesi baltici',
  },
  es: {
    Germany: 'Alemania',
    Netherlands: 'Países Bajos',
    Poland: 'Polonia',
    France: 'Francia',
    Italy: 'Italia',
    Spain: 'España',
    UK: 'Reino Unido',
    UAE: 'EAU',
    Japan: 'Japón',
    Switzerland: 'Suiza',
    Scandinavia: 'Escandinavia',
    Romania: 'Rumanía',
    Czechia: 'Chequia',
    Kazakhstan: 'Kazajistán',
    Armenia: 'Armenia',
    Azerbaijan: 'Azerbaiyán',
    Israel: 'Israel',
    'Baltic states': 'países bálticos',
  },
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

    if (!product || !isPubliclyListedProduct(product)) {
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
        : (CATEGORY_EXPORT_MARKETS[category] ?? CATEGORY_EXPORT_MARKETS.other).slice(0, 2);
    const localizedMarkets = markets.map((market) => this.localizeMarket(market, locale));
    const marketLabel = this.joinMarkets(localizedMarkets, locale);
    const weeksToSeason = this.weeksUntil(product.harvestStartAt);
    const listedPrice = toNumberOrNull(product.priceFrom);
    const currency = product.priceCurrency ?? 'EUR';

    const summary = this.summaryText({
      locale,
      variety,
      origin,
      marketLabel,
      weeksToSeason,
      harvestStatus: product.harvestStatus,
    });

    const highlights = this.highlights({
      locale,
      marketLabel,
      weeksToSeason,
      listedPrice,
      currency,
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
    weeksToSeason: number | null;
    harvestStatus: string | null;
  }): string {
    const timing = this.seasonSummary(params.locale, params.weeksToSeason, params.harvestStatus);
    const { variety, origin, marketLabel } = params;

    switch (params.locale) {
      case 'ru':
        return `Сигнал возможности по карточке «${variety}» из ${origin}. Указанные экспортные рынки: ${marketLabel}. ${timing}`;
      case 'ka':
        return `შესაძლებლობის სიგნალი ბარათის მიხედვით: ${variety} (${origin}). მითითებული საექსპორტო ბაზრები: ${marketLabel}. ${timing}`;
      case 'de':
        return `Ein Marktsignal aus den Angaben zu ${variety} aus ${origin}. Genannte Exportmärkte: ${marketLabel}. ${timing}`;
      case 'fr':
        return `Signal d’opportunité calculé à partir de la fiche ${variety} (${origin}). Marchés d’export indiqués : ${marketLabel}. ${timing}`;
      case 'it':
        return `Segnale di opportunità dalla scheda di ${variety} da ${origin}. Mercati di export indicati: ${marketLabel}. ${timing}`;
      case 'es':
        return `Señal de oportunidad a partir de la ficha de ${variety} de ${origin}. Mercados de exportación indicados: ${marketLabel}. ${timing}`;
      default:
        return `An opportunity signal from the ${variety} listing from ${origin}. Stated export markets: ${marketLabel}. ${timing}`;
    }
  }

  private seasonSummary(
    locale: Locale,
    weeksToSeason: number | null,
    harvestStatus: string | null,
  ): string {
    if (weeksToSeason == null) {
      if (harvestStatus === 'available') {
        return {
          en: 'The listing is marked as in season.',
          ru: 'В карточке указано, что товар в сезоне.',
          ka: 'ბარათზე მონიშნულია, რომ პროდუქტი სეზონშია.',
          de: 'Das Angebot ist als saisonal verfügbar gekennzeichnet.',
          fr: 'L’annonce est indiquée comme étant de saison.',
          it: 'L’inserzione è indicata come in stagione.',
          es: 'El anuncio está marcado como en temporada.',
        }[locale];
      }
      return {
        en: 'No harvest start date is stated on the listing.',
        ru: 'Дата начала сезона в карточке не указана.',
        ka: 'ბარათზე სეზონის დაწყების თარიღი მითითებული არ არის.',
        de: 'Ein Erntestart ist in der Anzeige nicht angegeben.',
        fr: 'Aucune date de début de récolte n’est indiquée sur la fiche.',
        it: 'La scheda non indica una data di inizio raccolto.',
        es: 'La ficha no indica una fecha de inicio de cosecha.',
      }[locale];
    }
    if (weeksToSeason <= 0) {
      return {
        en: 'The stated harvest start has begun or is imminent.',
        ru: 'Указанное начало сезона уже наступило или близко.',
        ka: 'მითითებული სეზონის დაწყება უკვე დადგა ან ახლოვდება.',
        de: 'Der angegebene Erntestart hat begonnen oder steht unmittelbar bevor.',
        fr: 'Le début de récolte indiqué a commencé ou est imminent.',
        it: 'L’inizio raccolto indicato è iniziato o è imminente.',
        es: 'El inicio de cosecha indicado ya comenzó o es inminente.',
      }[locale];
    }
    if (weeksToSeason === 1) {
      return {
        en: 'About one week remains before the stated harvest start.',
        ru: 'До указанного начала сезона осталась примерно одна неделя.',
        ka: 'მითითებული სეზონის დაწყებამდე დაახლოებით ერთი კვირაა.',
        de: 'Bis zum angegebenen Erntestart bleibt etwa eine Woche.',
        fr: 'Il reste environ une semaine avant le début de récolte indiqué.',
        it: 'Manca circa una settimana all’inizio raccolto indicato.',
        es: 'Queda aproximadamente una semana para el inicio de cosecha indicado.',
      }[locale];
    }
    return {
      en: `About ${weeksToSeason} weeks remain before the stated harvest start.`,
      ru: `До указанного начала сезона осталось около ${weeksToSeason} недель.`,
      ka: `მითითებული სეზონის დაწყებამდე დაახლოებით ${weeksToSeason} კვირაა.`,
      de: `Bis zum angegebenen Erntestart bleiben etwa ${weeksToSeason} Wochen.`,
      fr: `Il reste environ ${weeksToSeason} semaines avant le début de récolte indiqué.`,
      it: `Mancano circa ${weeksToSeason} settimane all’inizio raccolto indicato.`,
      es: `Quedan aproximadamente ${weeksToSeason} semanas para el inicio de cosecha indicado.`,
    }[locale];
  }

  private highlights(params: {
    locale: Locale;
    marketLabel: string;
    weeksToSeason: number | null;
    listedPrice: number | null;
    currency: string;
    preorderEnabled: boolean;
    harvestStatus: string | null;
  }): string[] {
    const copy = {
      en: {
        markets: `Export markets: ${params.marketLabel}`,
        listed: `Listed price: ${params.listedPrice} ${params.currency}`,
        inSeason: 'Harvest status: in season',
        buyingOpen: 'Harvest status: buying window open',
        started: 'Season: stated start has begun',
        weeks: `Season in: ~${params.weeksToSeason} weeks`,
        preorder: 'Pre-order: available on this listing',
        volumes: 'Listing note: confirm volumes with the seller',
      },
      ru: {
        markets: `Экспортные рынки: ${params.marketLabel}`,
        listed: `Цена в карточке: ${params.listedPrice} ${params.currency}`,
        inSeason: 'Статус сбора: в сезоне',
        buyingOpen: 'Статус сбора: закупки возможны',
        started: 'Сезон: указанное начало уже наступило',
        weeks: `До сезона: ~${params.weeksToSeason} нед.`,
        preorder: 'Предзаказ: доступен в карточке',
        volumes: 'В карточке: уточните объёмы у продавца',
      },
      ka: {
        markets: `საექსპორტო ბაზრები: ${params.marketLabel}`,
        listed: `ბარათის ფასი: ${params.listedPrice} ${params.currency}`,
        inSeason: 'მოსავლის სტატუსი: სეზონშია',
        buyingOpen: 'მოსავლის სტატუსი: შესყიდვა შესაძლებელია',
        started: 'სეზონი: მითითებული დაწყება უკვე დადგა',
        weeks: `სეზონამდე: ~${params.weeksToSeason} კვ.`,
        preorder: 'წინასწარი შეკვეთა: ხელმისაწვდომია ბარათზე',
        volumes: 'ბარათის შენიშვნა: მოცულობა დააზუსტეთ გამყიდველთან',
      },
      de: {
        markets: `Exportmärkte: ${params.marketLabel}`,
        listed: `Angezeigter Preis: ${params.listedPrice} ${params.currency}`,
        inSeason: 'Erntestatus: in der Saison',
        buyingOpen: 'Erntestatus: Einkauf möglich',
        started: 'Saison: angegebener Start hat begonnen',
        weeks: `Saison in: ~${params.weeksToSeason} Wochen`,
        preorder: 'Vorbestellung: in der Anzeige verfügbar',
        volumes: 'Hinweis: Mengen mit dem Anbieter klären',
      },
      fr: {
        markets: `Marchés d’export : ${params.marketLabel}`,
        listed: `Prix indiqué : ${params.listedPrice} ${params.currency}`,
        inSeason: 'Statut de récolte : de saison',
        buyingOpen: 'Statut de récolte : achat possible',
        started: 'Saison : le début indiqué a commencé',
        weeks: `Saison dans : ~${params.weeksToSeason} semaines`,
        preorder: 'Précommande : disponible sur la fiche',
        volumes: 'Note : confirmer les volumes avec le vendeur',
      },
      it: {
        markets: `Mercati di export: ${params.marketLabel}`,
        listed: `Prezzo in scheda: ${params.listedPrice} ${params.currency}`,
        inSeason: 'Stato raccolto: in stagione',
        buyingOpen: 'Stato raccolto: acquisto possibile',
        started: 'Stagione: l’inizio indicato è iniziato',
        weeks: `Stagione tra: ~${params.weeksToSeason} settimane`,
        preorder: 'Preordine: disponibile sulla scheda',
        volumes: 'Nota: confermare i volumi con il venditore',
      },
      es: {
        markets: `Mercados de exportación: ${params.marketLabel}`,
        listed: `Precio indicado: ${params.listedPrice} ${params.currency}`,
        inSeason: 'Estado de cosecha: en temporada',
        buyingOpen: 'Estado de cosecha: compra posible',
        started: 'Temporada: el inicio indicado ya comenzó',
        weeks: `Temporada en: ~${params.weeksToSeason} semanas`,
        preorder: 'Preventa: disponible en la ficha',
        volumes: 'Nota: confirme volúmenes con el vendedor',
      },
    }[params.locale];

    const items = [copy.markets];
    if (params.listedPrice != null) {
      items.push(copy.listed);
    }
    items.push(
      params.weeksToSeason == null
        ? params.harvestStatus === 'available'
          ? copy.inSeason
          : copy.buyingOpen
        : params.weeksToSeason <= 0
          ? copy.started
          : copy.weeks,
    );
    items.push(params.preorderEnabled ? copy.preorder : copy.volumes);
    return items;
  }

  private joinMarkets(labels: string[], locale: Locale): string {
    if (labels.length <= 1) return labels[0] ?? '';
    const joiner = {
      en: ' and ',
      ru: ' и ',
      ka: ' და ',
      de: ' und ',
      fr: ' et ',
      it: ' e ',
      es: ' y ',
    }[locale];
    return labels.join(joiner);
  }

  private localizeMarket(market: string, locale: Locale): string {
    return MARKET_LABELS[locale][market] ?? market;
  }

  private weeksUntil(date: Date | null): number | null {
    if (!date) return null;
    const diffMs = date.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
  }
}
