'use client';

import { COOKIE_NOTICE_STORAGE_KEY } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';

export function CookieNotice() {
  const t = useTranslations('legal');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, '1');
    } catch {
      /* private mode */
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-notice" role="dialog" aria-label={t('cookieNoticePolicy')}>
      <p>
        {t('cookieNotice')}{' '}
        <Link href="/legal/cookies">{t('cookieNoticePolicy')}</Link>
      </p>
      <button className="button button--primary" type="button" onClick={acknowledge}>
        {t('cookieNoticeOk')}
      </button>
    </div>
  );
}
