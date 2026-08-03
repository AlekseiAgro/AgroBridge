'use client';

import type { HarvestStatus } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  status: HarvestStatus | null | undefined;
  preorderEnabled?: boolean;
  className?: string;
};

export function HarvestStatusBadge({
  status,
  preorderEnabled = false,
  className = '',
}: Props) {
  const t = useTranslations('harvest');
  if (!status && !preorderEnabled) return null;

  return (
    <span className={`harvest-badges ${className}`.trim()}>
      {status ? (
        <span className={`harvest-badge harvest-badge--${status}`}>{t(`status.${status}`)}</span>
      ) : null}
      {preorderEnabled ? (
        <span className="harvest-badge harvest-badge--preorder">{t('preorderBadge')}</span>
      ) : null}
    </span>
  );
}
