'use client';

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

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Picks up a choice made in another tab when this one regains focus.
  window.addEventListener('focus', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('focus', listener);
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

  useEffect(() => {
    if (consent === 'denied') revokeMetaPixel();
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
      for (const listener of listeners) listener();
      closeSettings();
    },
    [closeSettings],
  );

  const openSettings = useCallback((trigger: HTMLElement | null) => {
    returnFocusRef.current = trigger;
    setSettingsOpen(true);
  }, []);

  const value = useMemo(() => ({ enabled, openSettings }), [enabled, openSettings]);
  const bannerMode = consent === null ? 'firstVisit' : settingsOpen ? 'settings' : null;

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {enabled && consent !== undefined && bannerMode ? (
        <CookieConsentBanner
          mode={bannerMode}
          consent={consent}
          onAccept={() => choose('granted')}
          onReject={() => choose('denied')}
          onClose={closeSettings}
        />
      ) : null}
      {pixelId && consent === 'granted' ? (
        <Suspense fallback={null}>
          <MetaPixelPageViews pixelId={pixelId} />
        </Suspense>
      ) : null}
    </CookieConsentContext.Provider>
  );
}
