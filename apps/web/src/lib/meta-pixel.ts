/**
 * Meta Pixel, loaded only after the visitor accepts advertising cookies.
 *
 * Nothing here runs at import time: the script, the `fbq` queue and every
 * event are created by `loadMetaPixel`, which the consent provider calls only
 * for a stored `granted` choice. Kept free of imports so `node --test` can
 * load it directly.
 */

export const META_PIXEL_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Cookies the Pixel script sets on the site's own domain. */
export const META_PIXEL_FIRST_PARTY_COOKIES = ['_fbp', '_fbc'] as const;

const REGISTRATION_MARKER_PREFIX = 'agrobridge_meta_registration_tracked:';

/** Path segments (after the locale) whose URLs carry one-time secrets. */
const UNTRACKED_PATH_SEGMENTS = new Set(['reset-password']);

/** Query parameters that may carry secrets or personal data. */
const SENSITIVE_QUERY_PARAMS = ['token', 'code', 'email'];

/** Accepts only a numeric Pixel ID; anything else leaves the Pixel disabled. */
export function normalizeMetaPixelId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  return /^\d{5,20}$/.test(value) ? value : null;
}

export function configuredMetaPixelId(): string | null {
  return normalizeMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

/**
 * The Pixel always reports the full page URL, so pages whose URL carries a
 * secret (the password-reset token) or personal data must not send events.
 */
export function isMetaPixelTrackableUrl(pathname: string, search: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => UNTRACKED_PATH_SEGMENTS.has(segment))) return false;
  const params = new URLSearchParams(search);
  return !SENSITIVE_QUERY_PARAMS.some((name) => params.has(name));
}

type MarkerStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Records that CompleteRegistration was sent for this account and returns
 * whether this call is the first one. The marker stays in the browser.
 */
export function claimRegistrationEvent(
  storage: MarkerStorage | null,
  memory: Set<string>,
  userId: string,
): boolean {
  if (!userId) return false;
  const key = `${REGISTRATION_MARKER_PREFIX}${userId}`;
  if (memory.has(key)) return false;
  memory.add(key);
  try {
    if (storage?.getItem(key)) return false;
    storage?.setItem(key, '1');
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory guard still applies.
  }
  return true;
}

/** Host-only first, then each parent domain the Pixel may have used. */
export function cookieDomainCandidates(hostname: string): string[] {
  const labels = hostname.split('.').filter(Boolean);
  const candidates = [''];
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1])) return candidates;
  for (let index = 0; index <= labels.length - 2; index += 1) {
    candidates.push(labels.slice(index).join('.'));
  }
  return candidates;
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let activePixelId: string | null = null;
const initializedPixelIds = new Set<string>();
let lastPageViewUrl: string | null = null;
const claimedRegistrations = new Set<string>();

function installFbq(): Fbq {
  if (window.fbq) return window.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      Reflect.apply(fbq.callMethod, fbq, args);
    } else {
      fbq.queue.push(args);
    }
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  // PageView is sent explicitly on route changes; the script's own
  // history.pushState listener would double-count client-side navigation,
  // and without allowDuplicatePageViews it drops every PageView after the
  // first one in the same document. trackMetaPageView de-duplicates instead.
  fbq.disablePushState = true;
  fbq.allowDuplicatePageViews = true;
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = META_PIXEL_SCRIPT_SRC;
  document.head.appendChild(script);
  return fbq;
}

export function loadMetaPixel(pixelId: string): void {
  if (typeof window === 'undefined' || activePixelId === pixelId) return;
  const fbq = installFbq();
  if (initializedPixelIds.has(pixelId)) {
    fbq('consent', 'grant');
  } else {
    // Automatic configuration would collect button clicks and page metadata.
    fbq('set', 'autoConfig', false, pixelId);
    fbq('init', pixelId);
    initializedPixelIds.add(pixelId);
  }
  activePixelId = pixelId;
}

/**
 * Stops all further events after consent is withdrawn and removes the
 * Pixel's first-party cookies. An already-downloaded script stays in memory
 * until the next full page load but sends nothing while consent is revoked.
 */
export function revokeMetaPixel(): void {
  if (typeof window === 'undefined') return;
  if (activePixelId && window.fbq) window.fbq('consent', 'revoke');
  activePixelId = null;
  lastPageViewUrl = null;
  for (const domain of cookieDomainCandidates(window.location.hostname)) {
    for (const name of META_PIXEL_FIRST_PARTY_COOKIES) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}

/** Sends PageView once per distinct URL; returns whether it was sent. */
export function trackMetaPageView(pathname: string, search: string): boolean {
  if (!activePixelId || !window.fbq) return false;
  if (!isMetaPixelTrackableUrl(pathname, search)) return false;
  const url = `${pathname}${search}`;
  if (url === lastPageViewUrl) return false;
  lastPageViewUrl = url;
  window.fbq('track', 'PageView');
  return true;
}

/**
 * Sends CompleteRegistration at most once per new account, without any
 * parameters: no email, name, role or account identifier reaches Meta.
 */
export function trackMetaCompleteRegistration(userId: string): boolean {
  if (!activePixelId || !window.fbq) return false;
  let storage: MarkerStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  if (!claimRegistrationEvent(storage, claimedRegistrations, userId)) return false;
  window.fbq('track', 'CompleteRegistration');
  return true;
}
