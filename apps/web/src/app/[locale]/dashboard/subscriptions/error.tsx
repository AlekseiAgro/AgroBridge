'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SubscriptionsError({ error, reset }: Props) {
  const t = useTranslations('subscriptions');

  useEffect(() => {
    console.error('Subscriptions page error', error);
  }, [error]);

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <p className="form-error">{t('pageError')}</p>
      <button type="button" className="button button--primary" onClick={() => reset()}>
        {t('retry')}
      </button>
    </main>
  );
}
