'use client';

import { useTranslations } from 'next-intl';

type Props = {
  verified?: boolean;
  className?: string;
};

/** Public trust badge shown only for approved producers. */
export function VerifiedBadge({ verified = false, className = '' }: Props) {
  const t = useTranslations('farm.verification');
  if (!verified) return null;

  return (
    <span className={`verified-badge ${className}`.trim()} title={t('badgeHint')}>
      <span className="verified-badge__mark" aria-hidden>
        ✓
      </span>
      {t('badge')}
    </span>
  );
}
