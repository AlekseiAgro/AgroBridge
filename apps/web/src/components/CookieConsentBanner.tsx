'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import type { AdvertisingConsent } from '@/lib/cookie-consent';

type Props = {
  mode: 'firstVisit' | 'settings';
  consent: AdvertisingConsent | null;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
};

export function CookieConsentBanner({ mode, consent, onAccept, onReject, onClose }: Props) {
  const t = useTranslations('cookieConsent');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closable = mode === 'settings' && consent !== null;

  useEffect(() => {
    if (mode === 'settings') headingRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (!closable) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closable, onClose]);

  return (
    <section
      className="cookie-consent"
      // The first-visit banner does not take focus, so it is a labelled region
      // reachable by landmark navigation; settings are opened on request and
      // receive focus like a dialog.
      role={mode === 'settings' ? 'dialog' : 'region'}
      aria-modal={mode === 'settings' ? 'false' : undefined}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="cookie-consent__inner">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="cookie-consent__title">
          {mode === 'settings' ? t('settingsTitle') : t('title')}
        </h2>
        <div id={descriptionId} className="cookie-consent__body">
          <p>{t('necessary')}</p>
          <p>{t('advertising')}</p>
          {mode === 'settings' && consent ? (
            <p className="cookie-consent__status">
              {consent === 'granted' ? t('statusGranted') : t('statusDenied')}
            </p>
          ) : null}
          <p>
            <Link href="/privacy" className="cookie-consent__link">
              {t('privacyLink')}
            </Link>
          </p>
        </div>
        <div className="cookie-consent__actions">
          <button type="button" className="button button--primary" onClick={onReject}>
            {t('reject')}
          </button>
          <button type="button" className="button button--primary" onClick={onAccept}>
            {t('accept')}
          </button>
          {closable ? (
            <button type="button" className="button button--ghost" onClick={onClose}>
              {t('close')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
