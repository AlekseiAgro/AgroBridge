'use client';

import { useTranslations } from 'next-intl';
import { useCookieConsent } from '@/components/CookieConsentProvider';

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations('cookieConsent');
  const { enabled, openSettings } = useCookieConsent();

  if (!enabled) return null;

  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={(event) => openSettings(event.currentTarget)}
    >
      {t('settingsButton')}
    </button>
  );
}
