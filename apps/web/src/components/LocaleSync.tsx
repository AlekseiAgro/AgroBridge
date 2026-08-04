'use client';

import { isLocale, type Locale } from '@agrobridge/shared';
import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';

type Props = {
  profileLocale?: string | null;
};

/**
 * Keeps the authenticated user's chat/profile locale aligned with the active UI language.
 * Chat translation targets User.locale, while the language switcher only changes the URL.
 */
export function LocaleSync({ profileLocale }: Props) {
  const uiLocale = useLocale();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!isLocale(uiLocale)) return;
    if (profileLocale === uiLocale) {
      lastSynced.current = uiLocale;
      return;
    }
    if (lastSynced.current === uiLocale) return;

    lastSynced.current = uiLocale;
    void fetch('/api/cabinet/me/locale', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: uiLocale as Locale }),
      credentials: 'same-origin',
    })
      .then((response) => {
        // fetch only rejects on network errors; 401/403/500 must reset so we retry.
        if (!response.ok) {
          lastSynced.current = null;
        }
      })
      .catch(() => {
        lastSynced.current = null;
      });
  }, [uiLocale, profileLocale]);

  return null;
}
