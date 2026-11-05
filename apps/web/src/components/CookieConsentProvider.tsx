'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { MetaPixelPageViews } from '@/components/MetaPixelPageViews';
import {
  parseAdvertisingConsent,
  serializeAdvertisingConsent,
  type AdvertisingConsent,
} from '@/lib/cookie-consent';
import { configuredMetaPixelId, revokeMetaPixel } from '@/lib/meta-pixel';

type CookieConsentContextValue = {
  /** False when no optional cookies are configured, so there is nothing to ask. */
  enabled: boolean;
  openSettings: (trigger: HTMLElement | null) => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue>({
  enabled: false,
  openSettings: () => {},
});

const listeners = new Set<() => void>();
const CONSENT_CHANNEL_NAME = 'agrobridge-cookie-consent';
let consentChannel: BroadcastChannel | null = null;

function notifyListeners() {
  for (const listener of listeners) listener();
}

/**
 * Another tab changed the stored choice, or this page came back from the
 * back/forward cache. Withdrawal is applied here, synchronously, rather than
 * after React re-renders, so Meta's own `pageshow` PageView cannot slip
 * through first.
 */
function onExternalConsentChange() {
  if (readStoredConsent() !== 'granted') revokeMetaPixel();
  notifyListeners();
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') onExternalConsentChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (typeof BroadcastChannel !== 'undefined') {
      consentChannel = new BroadcastChannel(CONSENT_CHANNEL_NAME);
      consentChannel.onmessage = onExternalConsentChange;
    }
    // Fallbacks for browsers without BroadcastChannel and for frozen pages.
    window.addEventListener('focus', onExternalConsentChange);
    window.addEventListener('pageshow', onExternalConsentChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    consentChannel?.close();
    consentChannel = null;
    window.removeEventListener('focus', onExternalConsentChange);
    window.removeEventListener('pageshow', onExternalConsentChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

function readStoredConsent(): AdvertisingConsent | null {
  return parseAdvertisingConsent(document.cookie);
}

/** `undefined` while server rendering and hydrating: the choice is not known yet. */
function readServerConsent(): AdvertisingConsent | null | undefined {
  return undefined;
}

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const pixelId = configuredMetaPixelId();
  const enabled = pixelId !== null;
  const consent = useSyncExternalStore(subscribe, readStoredConsent, readServerConsent);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const t = useTranslations('cookieConsent');

  useEffect(() => {
    if (consent === 'denied' || consent === null) revokeMetaPixel();
  }, [consent]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger?.isConnected) trigger.focus();
  }, []);

  const choose = useCallback(
    (next: AdvertisingConsent) => {
      document.cookie = serializeAdvertisingConsent(next, {
        secure: window.location.protocol === 'https:',
      });
      if (next !== 'granted') revokeMetaPixel();
      notifyListeners();
      consentChannel?.postMessage(next);
      setAnnouncement('');
      window.setTimeout(() => {
        setAnnouncement(`${t('saved')} ${next === 'granted' ? t('statusGranted') : t('statusDenied')}`);
      }, 100);
      closeSettings();
    },
    [closeSettings, t],
  );

  const openSettings = useCallback((trigger: HTMLElement | null) => {
    returnFocusRef.current = trigger;
    setSettingsOpen(true);
  }, []);

  const value = useMemo(() => ({ enabled, openSettings }), [enabled, openSettings]);
  const bannerMode = consent === null ? 'firstVisit' : settingsOpen ? 'settings' : null;

  return (
    <CookieConsentContext.Provider value={value}>
      {/* First in the document so keyboard and screen-reader users reach it before the page. */}
      {enabled && consent !== undefined && bannerMode ? (
        <CookieConsentBanner
          mode={bannerMode}
          consent={consent}
          onAccept={() => choose('granted')}
          onReject={() => choose('denied')}
          onClose={closeSettings}
        />
      ) : null}
      {children}
      {enabled ? (
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      ) : null}
      {pixelId && consent === 'granted' ? (
        <Suspense fallback={null}>
          <MetaPixelPageViews pixelId={pixelId} />
        </Suspense>
      ) : null}
    </CookieConsentContext.Provider>
  );
}
