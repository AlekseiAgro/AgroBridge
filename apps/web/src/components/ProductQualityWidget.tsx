'use client';

import type { ProductQualityScore } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  score: ProductQualityScore;
};

export function ProductQualityWidget({ score }: Props) {
  const t = useTranslations('quality');

  return (
    <section className={`quality-widget quality-widget--${score.tier}`} aria-live="polite">
      <div className="quality-widget__head">
        <div>
          <p className="quality-widget__eyebrow">{t('title')}</p>
          <p className="quality-widget__tier">{t(`tiers.${score.tier}`)}</p>
        </div>
        <div className="quality-widget__score" aria-label={t('scoreLabel', { score: score.score })}>
          <strong>{score.score}</strong>
          <span>/100</span>
        </div>
      </div>
      <div className="quality-widget__bar" aria-hidden>
        <span style={{ width: `${score.score}%` }} />
      </div>
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
          {t('nextHint')}: {score.suggestions.slice(0, 3).map((id) => t(`checklist.${id}`)).join(' · ')}
        </p>
      ) : (
        <p className="form-success">{t('complete')}</p>
      )}
    </section>
  );
}
