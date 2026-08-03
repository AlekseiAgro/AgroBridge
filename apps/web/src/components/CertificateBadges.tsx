'use client';

import type { CertificateType } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  badges: CertificateType[];
  className?: string;
};

export function CertificateBadges({ badges, className = '' }: Props) {
  const t = useTranslations('quality');
  if (badges.length === 0) return null;

  return (
    <span className={`cert-badges ${className}`.trim()}>
      {badges.map((badge) => (
        <span key={badge} className="cert-badge">
          {t(`certificates.${badge}`)}
        </span>
      ))}
    </span>
  );
}
