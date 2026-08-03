import type { HarvestStatus, SeasonMonth } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';

type Props = {
  seasonMonths: SeasonMonth[] | number[];
  harvestStartAt: string | null;
  harvestEndAt: string | null;
  forecastQuantity: number | null;
  harvestStatus: HarvestStatus | null;
  preorderEnabled: boolean;
  unitLabel?: string | null;
};

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export async function HarvestPlanSummary({
  seasonMonths,
  harvestStartAt,
  harvestEndAt,
  forecastQuantity,
  harvestStatus,
  preorderEnabled,
  unitLabel,
  locale,
}: Props & { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'harvest' });
  const hasPlan =
    seasonMonths.length > 0 ||
    harvestStartAt ||
    harvestEndAt ||
    forecastQuantity != null ||
    harvestStatus ||
    preorderEnabled;

  if (!hasPlan) return null;

  const start = formatDate(harvestStartAt, locale);
  const end = formatDate(harvestEndAt, locale);
  const windowLabel =
    start && end ? `${start} – ${end}` : start || end || null;

  return (
    <section className="harvest-plan">
      <div className="harvest-plan__header">
        <h2 className="section-title">{t('title')}</h2>
        <HarvestStatusBadge status={harvestStatus} preorderEnabled={preorderEnabled} />
      </div>
      <dl className="account-details">
        {seasonMonths.length > 0 ? (
          <div>
            <dt>{t('seasonality')}</dt>
            <dd>
              {seasonMonths
                .map((month) => t(`months.${month as SeasonMonth}`))
                .join(', ')}
            </dd>
          </div>
        ) : null}
        {windowLabel ? (
          <div>
            <dt>{t('window')}</dt>
            <dd>{windowLabel}</dd>
          </div>
        ) : null}
        {forecastQuantity != null ? (
          <div>
            <dt>{t('forecast')}</dt>
            <dd>
              {forecastQuantity}
              {unitLabel ? ` ${unitLabel}` : ''}
            </dd>
          </div>
        ) : null}
        {preorderEnabled ? (
          <div>
            <dt>{t('preorder')}</dt>
            <dd>{t('preorderYes')}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
