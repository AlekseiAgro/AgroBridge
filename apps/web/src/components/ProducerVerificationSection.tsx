'use client';

import type { ProducerVerificationStatus } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProducerVerificationPanel } from '@/components/ProducerVerificationPanel';
import { verificationPresentation } from '@/lib/verification-presentation';

type Props = {
  initial: ProducerVerificationStatus;
};

/**
 * Contextual owner-only verification chrome. Fully verified farms hide the workflow
 * (the public Verified badge is enough). Everyone else reuses the existing panel.
 */
export function ProducerVerificationSection({ initial }: Props) {
  const presentation = verificationPresentation(initial);
  const [expanded, setExpanded] = useState(
    presentation === 'workflow' || presentation === 'attention',
  );
  const t = useTranslations('farm.verification');

  if (presentation === 'hidden') {
    return null;
  }

  const reasonText =
    initial.verificationReasonCode != null ? t(`reason.${initial.verificationReasonCode}`) : null;

  if (!expanded) {
    const attention = presentation === 'attention';
    return (
      <section
        className={
          attention ? 'verification-prompt verification-prompt--attention' : 'verification-prompt'
        }
      >
        <h2 className="section-title">{attention ? t('attentionTitle') : t('promptTitle')}</h2>
        <p className="page__subtitle">{attention ? t('attentionBody') : t('promptBody')}</p>
        {attention && reasonText ? (
          <p className="form-error">
            {t('reason.label')}: {reasonText}
          </p>
        ) : null}
        {attention && initial.moderatorComment ? (
          <p className="product-list__meta">
            {t('reason.moderatorComment')}: {initial.moderatorComment}
          </p>
        ) : null}
        <button type="button" className="button button--primary" onClick={() => setExpanded(true)}>
          {attention ? t('continue') : t('start')}
        </button>
      </section>
    );
  }

  return (
    <div className="verification-section">
      {presentation === 'attention' ? (
        <div className="verification-prompt verification-prompt--attention verification-prompt--inline">
          <h2 className="section-title">{t('attentionTitle')}</h2>
          <p className="page__subtitle">{t('attentionBody')}</p>
          {reasonText ? (
            <p className="form-error">
              {t('reason.label')}: {reasonText}
            </p>
          ) : null}
          {initial.moderatorComment ? (
            <p className="product-list__meta">
              {t('reason.moderatorComment')}: {initial.moderatorComment}
            </p>
          ) : null}
        </div>
      ) : null}
      <ProducerVerificationPanel initial={initial} />
    </div>
  );
}
