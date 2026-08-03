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
  },
};

function joinMarkets(markets: string[], locale: string): string {
  const map = MARKET_LABELS[locale] ?? {};
  const labels = markets.map((market) => map[market] ?? market);
  if (locale === 'ru') return labels.join(' и ');
  if (locale === 'ka') return labels.join(' და ');
  if (labels.length <= 1) return labels[0] ?? '';
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
