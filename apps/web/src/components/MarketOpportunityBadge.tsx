'use client';

import type { MarketOpportunity } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';

type Props = {
  opportunity: MarketOpportunity;
  className?: string;
};

const MARKET_LABELS: Record<string, Record<string, string>> = {
  ru: {
    Germany: 'Германии',
    Netherlands: 'Нидерландах',
    Poland: 'Польше',
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
  },
  ka: {
    Germany: 'გერმანიაში',
    Netherlands: 'ნიდერლანდებში',
    Poland: 'პოლონეთში',
    France: 'საფრანგეთში',
    Italy: 'იტალიაში',
    Spain: 'ესპანეთში',
    UK: 'გაერთიანებულ სამეფოში',
    UAE: 'არაბთა გაერთიანებულ საამიროებში',
    Japan: 'იაპონიაში',
    Switzerland: 'შვეიცარიაში',
    Scandinavia: 'სკანდინავიაში',
    Romania: 'რუმინეთში',
    Czechia: 'ჩეხეთში',
    Kazakhstan: 'ყაზახეთში',
    Armenia: 'სომხეთში',
    Azerbaijan: 'აზერბაიჯანში',
    Israel: 'ისრაელში',
    'Baltic states': 'ბალტიისპირეთის ქვეყნებში',
  },
  de: {
    Germany: 'Deutschland',
    Netherlands: 'den Niederlanden',
    Poland: 'Polen',
    France: 'Frankreich',
    Italy: 'Italien',
    Spain: 'Spanien',
    UK: 'Großbritannien',
    UAE: 'den VAE',
    Japan: 'Japan',
    Switzerland: 'der Schweiz',
    Scandinavia: 'Skandinavien',
    Romania: 'Rumänien',
    Czechia: 'Tschechien',
    Kazakhstan: 'Kasachstan',
    Armenia: 'Armenien',
    Azerbaijan: 'Aserbaidschan',
    Israel: 'Israel',
    'Baltic states': 'den baltischen Staaten',
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

function joinMarkets(markets: string[], locale: string): string {
  const map = MARKET_LABELS[locale] ?? {};
  const labels = markets.map((market) => map[market] ?? market);
  if (labels.length <= 1) return labels[0] ?? '';
  if (locale === 'ru') return labels.join(' и ');
  if (locale === 'ka') return labels.join(' და ');
  if (locale === 'de') {
    return labels.length === 2
      ? `${labels[0]} und ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} und ${labels[labels.length - 1]}`;
  }
  if (locale === 'fr') {
    return labels.length === 2
      ? `${labels[0]} et ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
  }
  if (locale === 'it') {
    return labels.length === 2
      ? `${labels[0]} e ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
  }
  if (locale === 'es') {
    return labels.length === 2
      ? `${labels[0]} y ${labels[1]}`
      : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export function MarketOpportunityBadge({ opportunity, className = '' }: Props) {
  const t = useTranslations('opportunity');
  const locale = useLocale();
  const markets = joinMarkets(opportunity.markets, locale);

  const demand = opportunity.highDemand
    ? t('tooltip.highDemand', { markets })
    : t('tooltip.steadyDemand', { markets });

  const supply = opportunity.limitedSupply
    ? t('tooltip.limitedSupply')
    : t('tooltip.availableSupply');

  const price =
    opportunity.priceRiseLikely &&
    opportunity.weeksToSeason != null &&
    opportunity.weeksToSeason > 0
      ? opportunity.weeksToSeason === 3
        ? t('tooltip.priceRiseThreeWeeks')
        : t('tooltip.priceRiseWeeks', { weeks: opportunity.weeksToSeason })
      : opportunity.priceRiseLikely
        ? t('tooltip.priceRiseSoon')
        : t('tooltip.priceStable', { percent: opportunity.priceDeltaPercent });

  const tooltip = `${demand} ${supply} ${price}`;

  return (
    <span
      className={`opportunity-badge opportunity-badge--${opportunity.tier} ${className}`.trim()}
      title={tooltip}
      tabIndex={0}
      aria-label={`${t(`tiers.${opportunity.tier}`)}. ${tooltip}`}
    >
      <span className="opportunity-badge__dot" aria-hidden />
      <span className="opportunity-badge__label">{t(`tiers.${opportunity.tier}`)}</span>
      <span className="opportunity-badge__tip" role="tooltip">
        {tooltip}
      </span>
    </span>
  );
}
