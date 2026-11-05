/**
 * Meta Pixel, loaded only after the visitor accepts advertising cookies.
 *
 * Nothing here runs at import time: the script, the `fbq` queue and every
 * event are created by `syncMetaPixel`, which the consent provider calls only
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

/** A value that embeds a secret-bearing URL (e.g. `?next=/x?token=`) or an email address. */
const SENSITIVE_VALUE_PATTERN = /(^|[?&#/])(token|code|email)=|@/i;

/** `fbq` calls that send an event; everything else configures the Pixel. */
const TRACKING_METHODS = new Set(['track', 'trackCustom', 'trackSingle', 'trackSingleCustom']);

/** Accepts only a numeric Pixel ID; anything else leaves the Pixel disabled. */
export function normalizeMetaPixelId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? '';
  return /^\d{5,20}$/.test(value) ? value : null;
}

export function configuredMetaPixelId(): string | null {
  return normalizeMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

/**
 * Meta's script reports `location.href` (query and fragment included) with
 * every event, so a page whose URL carries a secret or personal data must
 * not have the Pixel running at all.
 */
export function isMetaPixelTrackableUrl(pathname: string, search: string, hash = ''): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => UNTRACKED_PATH_SEGMENTS.has(segment))) return false;
  const params = new URLSearchParams(search);
  if (SENSITIVE_QUERY_PARAMS.some((name) => params.has(name))) return false;
  for (const value of params.values()) {
    if (SENSITIVE_VALUE_PATTERN.test(value)) return false;
  }
  const fragment = hash.replace(/^#/, '');
  return !(fragment && (fragment.includes('=') || fragment.includes('@')));
}

/**
 * Meta's script also reports `document.referrer`, which stays fixed for the
 * whole document. A sensitive referrer therefore rules the Pixel out until
 * the next full page load.
 */
export function isMetaPixelSafeReferrer(referrer: string): boolean {
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    return isMetaPixelTrackableUrl(url.pathname, url.search, url.hash);
  } catch {
    return false;
  }
}

type MarkerStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Records that CompleteRegistration was scheduled for this account and
 * returns whether this call is the first one. The marker stays in the browser.
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

/** Drops queued events in place, keeping configuration calls in order. */
export function discardQueuedEvents(queue: ArrayLike<unknown>[]): void {
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (TRACKING_METHODS.has(String(queue[index][0]))) queue.splice(index, 1);
  }
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: ArrayLike<unknown>[];
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
/** True after `consent revoke` was issued to `fbq` and not yet granted again. */
let fbqHalted = false;
let lastPageViewUrl: string | null = null;
const claimedRegistrations = new Set<string>();
/** Path of the registration form; the event waits until the visitor has left it. */
let pendingRegistrationFrom: string | null = null;
/**
 * Set once this document has shown a sensitive URL. Client-side navigation
 * keeps the same document and history, so the Pixel stays off until the next
 * full page load.
 */
let sensitiveDocument = false;

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

/**
 * Stops `fbq` from sending anything. `consent revoke` only takes effect when
 * Meta's script reaches it in the queue, so events queued ahead of it are
 * discarded first. Before the script has loaded, the whole queue (including
 * `init`) is dropped so the script never contacts Meta for this document.
 */
function haltFbq(fbq: Fbq): void {
  if (!fbq.callMethod) {
    fbq.queue.length = 0;
    initializedPixelIds.clear();
    fbqHalted = false;
  } else {
    discardQueuedEvents(fbq.queue);
  }
  if (!fbqHalted) {
    fbq('consent', 'revoke');
    fbqHalted = true;
  }
}

function startMetaPixel(pixelId: string): void {
  if (activePixelId === pixelId) return;
  const fbq = installFbq();
  // Anything queued while halted (e.g. Meta's own back/forward-cache
  // PageView) was collected without a usable page or consent.
  discardQueuedEvents(fbq.queue);
  if (fbqHalted) {
    fbq('consent', 'grant');
    fbqHalted = false;
  }
  if (!initializedPixelIds.has(pixelId)) {
    // Opts this Pixel out of Meta's automatic configuration (button-click
    // events, page metadata and, in the current library, the form-field
    // matching that rides on it). Meta-side settings can still enable other
    // collection, so Events Manager must be checked separately.
    fbq('set', 'autoConfig', false, pixelId);
    fbq('init', pixelId);
    initializedPixelIds.add(pixelId);
  }
  activePixelId = pixelId;
}

/** Keeps consent but sends nothing for the rest of a sensitive document. */
function pauseMetaPixel(): void {
  if (!activePixelId) return;
  if (window.fbq) haltFbq(window.fbq);
  activePixelId = null;
  lastPageViewUrl = null;
}

export type MetaPixelPage = {
  pathname: string;
  search: string;
  hash: string;
  referrer: string;
};

/**
 * Called for every route change while consent is granted. Loads the Pixel
 * only on pages whose URL and referrer are safe to report, then sends
 * PageView and any CompleteRegistration waiting for the visitor to leave the
 * registration form.
 */
export function syncMetaPixel(pixelId: string, page: MetaPixelPage): void {
  if (typeof window === 'undefined') return;
  if (
    sensitiveDocument ||
    !isMetaPixelTrackableUrl(page.pathname, page.search, page.hash) ||
    !isMetaPixelSafeReferrer(page.referrer)
  ) {
    sensitiveDocument = true;
    pauseMetaPixel();
    return;
  }
  startMetaPixel(pixelId);
  trackMetaPageView(page.pathname, page.search);
  if (pendingRegistrationFrom !== null && pendingRegistrationFrom !== page.pathname) {
    pendingRegistrationFrom = null;
    window.fbq?.('track', 'CompleteRegistration');
  }
}

/**
 * Called when consent is withdrawn: discards unsent events, stops the Pixel
 * and removes its first-party cookies. A downloaded script stays in memory
 * until the next full page load but sends nothing while consent is revoked.
 */
export function revokeMetaPixel(): void {
  if (typeof window === 'undefined') return;
  if (window.fbq) haltFbq(window.fbq);
  activePixelId = null;
  lastPageViewUrl = null;
  pendingRegistrationFrom = null;
  for (const domain of cookieDomainCandidates(window.location.hostname)) {
    for (const name of META_PIXEL_FIRST_PARTY_COOKIES) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}

/** Sends PageView once per distinct URL; returns whether it was sent. */
export function trackMetaPageView(pathname: string, search: string): boolean {
  if (!activePixelId || !window.fbq) return false;
  const url = `${pathname}${search}`;
  if (url === lastPageViewUrl) return false;
  lastPageViewUrl = url;
  window.fbq('track', 'PageView');
  return true;
}

/**
 * Schedules CompleteRegistration, at most once per new account, for the next
 * page after the registration form, so it is not sent while the email, name
 * and password fields are still on screen. The event has no parameters: no
 * email, name, role or account identifier is passed to Meta.
 */
export function scheduleMetaCompleteRegistration(userId: string): boolean {
  if (!activePixelId || !window.fbq) return false;
  let storage: MarkerStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  if (!claimRegistrationEvent(storage, claimedRegistrations, userId)) return false;
  pendingRegistrationFrom = window.location.pathname;
  return true;
}
