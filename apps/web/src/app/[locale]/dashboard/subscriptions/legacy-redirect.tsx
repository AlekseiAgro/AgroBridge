'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

const SETTINGS_NOTIFICATIONS_HREF = '/account/settings#notifications';

export function LegacySubscriptionsRedirect() {
  const router = useRouter();
  const t = useTranslations('cabinet');

  useEffect(() => {
    router.replace(SETTINGS_NOTIFICATIONS_HREF);
  }, [router]);

  return (
    <main className="cabinet-page cabinet-page--settings">
      <p className="page__subtitle">
        <Link href={SETTINGS_NOTIFICATIONS_HREF}>{t('notificationsSettingsTitle')}</Link>
      </p>
    </main>
  );
}
