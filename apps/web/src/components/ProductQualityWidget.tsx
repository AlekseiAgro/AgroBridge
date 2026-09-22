'use client';

import type { ProductQualityScore } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  score: ProductQualityScore;
  /** Checklist and fill recommendations — owners only. */
  showGuidance?: boolean;
  /** Summary-only presentation for the product form. Scoring is unchanged. */
  compact?: boolean;
};

export function ProductQualityWidget({ score, showGuidance = true, compact = false }: Props) {
  const t = useTranslations('quality');
  const tierLabel = t(`tiers.${score.tier}`);
  const nextSteps = score.suggestions.slice(0, 3);

  return (
    <section
      className={`quality-widget quality-widget--${score.tier}${compact ? ' quality-widget--compact' : ''}`}
      aria-live="polite"
    >
      <div className="quality-widget__head">
        <div>
          <h2 className="quality-widget__title">{t('title')}</h2>
          {compact ? (
            <p className="quality-widget__tier">
              {t('scoreWithTier', { score: score.score, tier: tierLabel })}
            </p>
          ) : (
            <p className="quality-widget__tier">{tierLabel}</p>
          )}
        </div>
        {compact ? null : (
          <div className="quality-widget__score" aria-label={t('scoreLabel', { score: score.score })}>
            <strong>{score.score}</strong>
            <span>/100</span>
          </div>
        )}
      </div>
      <div className="quality-widget__bar" aria-hidden>
        <span style={{ width: `${score.score}%` }} />
      </div>
      {compact ? (
        nextSteps.length > 0 ? (
          <div className="quality-widget__next">
            <p className="quality-widget__next-label">{t('nextHint')}</p>
            <ul className="quality-widget__next-list">
              {nextSteps.map((id) => (
                <li key={id}>{t(`checklist.${id}`)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="form-success">{t('complete')}</p>
        )
      ) : showGuidance ? (
        <>
          <ul className="quality-widget__list">
            {score.checklist.map((item) => (
              <li
                key={item.id}
                className={
                  item.done
                    ? 'quality-widget__item quality-widget__item--done'
                    : 'quality-widget__item'
                }
              >
                <span>{item.done ? '✓' : '○'}</span>
                <span>{t(`checklist.${item.id}`)}</span>
                <em>
                  {item.earned}/{item.weight}
                </em>
              </li>
            ))}
          </ul>
          {score.suggestions.length > 0 ? (
            <p className="page__subtitle">
              {t('nextHint')}:{' '}
              {score.suggestions
                .slice(0, 3)
                .map((id) => t(`checklist.${id}`))
                .join(' · ')}
            </p>
          ) : (
            <p className="form-success">{t('complete')}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
