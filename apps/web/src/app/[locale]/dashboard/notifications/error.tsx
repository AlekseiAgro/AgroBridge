'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function NotificationsError({ error, reset }: Props) {
  const t = useTranslations('notifications');

  useEffect(() => {
    console.error('Notifications page error', error);
  }, [error]);

  return (
    <main className="cabinet-page">
      <p className="form-error">{t('pageError')}</p>
      <button type="button" className="button button--primary" onClick={() => reset()}>
        {t('retry')}
      </button>
    </main>
  );
}
