'use client';

import type { ProductQualityScore } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  score: Pick<ProductQualityScore, 'score' | 'tier'>;
  /** Include tier label after the score (catalog). */
  showTier?: boolean;
  className?: string;
};

export function QualityScoreChip({ score, showTier = false, className = '' }: Props) {
  const t = useTranslations('quality');

  return (
    <span className={`quality-score-chip-wrap ${className}`.trim()}>
      <span className="quality-score-chip__name">{t('title')}</span>
      <span className={`quality-score-chip quality-score-chip--${score.tier}`}>
        {score.score}/100
        {showTier ? ` · ${t(`tiers.${score.tier}`)}` : null}
      </span>
    </span>
  );
}
