'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';

/**
 * Stands in for the verification panel when `/verification/me` fails. The panel used to
 * simply vanish, which reads as "this account has nothing to verify" rather than "we could
 * not reach the API", and leaves a seller with no way to get it back short of guessing.
 */
export function VerificationLoadError() {
  const t = useTranslations('farm.verification');
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <section className="verification-panel" style={{ marginTop: '2rem' }}>
      <div className="product-images__header">
        <h2 className="section-title">{t('title')}</h2>
        <p className="page__subtitle">{t('subtitle')}</p>
      </div>
      <p className="form-error">{t('loadError')}</p>
      <button
        type="button"
        className="button button--primary"
        disabled={retrying}
        onClick={() => startRetry(() => router.refresh())}
      >
        {retrying ? t('loadRetrying') : t('loadRetry')}
      </button>
    </section>
  );
}
