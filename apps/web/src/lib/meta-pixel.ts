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

/** First path segment, after an optional locale, of areas that require a signed-in user. */
const PRIVATE_ROOTS = new Set(['dashboard', 'account']);

const APP_LOCALES = new Set(['ka', 'en', 'ru', 'de', 'fr', 'es', 'it']);

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

function appSegments(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  return APP_LOCALES.has(segments[0] ?? '') ? segments.slice(1) : segments;
}

/** Cabinet, account, and the signed-in purchase-request form. Public request pages stay trackable. */
export function isPrivateAppPath(pathname: string): boolean {
  const segments = appSegments(pathname);
  if (PRIVATE_ROOTS.has(segments[0] ?? '')) return true;
  return segments[0] === 'requests' && segments[1] === 'new';
}

function decodeRepeated(value: string): string {
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function destinationIsPrivate(value: string, depth: number): boolean {
  if (depth > 4) return true;
  const decoded = decodeRepeated(value.trim());
  if (!decoded) return false;

  let pathname = decoded;
  let search = '';
  if (decoded.includes('://') || decoded.startsWith('//')) {
    try {
      const url = new URL(decoded.startsWith('//') ? `https:${decoded}` : decoded);
      pathname = url.pathname;
      search = url.search;
    } catch {
      return true;
    }
  } else {
    const withoutHash = decoded.split('#')[0] ?? decoded;
    const queryAt = withoutHash.indexOf('?');
    pathname = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
    search = queryAt === -1 ? '' : withoutHash.slice(queryAt);
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  }

  if (isPrivateAppPath(pathname)) return true;
  return search ? hasPrivateNextDestination(search, depth + 1) : false;
}

/** True when a `next` parameter points at a private page, including after decoding. */
export function hasPrivateNextDestination(search: string, depth = 0): boolean {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  for (const value of params.getAll('next')) {
    if (destinationIsPrivate(value, depth)) return true;
  }
  return false;
}

/** Secrets and one-time links. Seeing one keeps the Pixel off for the rest of the document. */
export function isMetaPixelSecretUrl(pathname: string, search: string, hash = ''): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => UNTRACKED_PATH_SEGMENTS.has(segment))) return true;
  const params = new URLSearchParams(search);
  if (SENSITIVE_QUERY_PARAMS.some((name) => params.has(name))) return true;
  for (const value of params.values()) {
    if (SENSITIVE_VALUE_PATTERN.test(decodeRepeated(value))) return true;
  }
  const fragment = hash.replace(/^#/, '');
  return Boolean(fragment && (fragment.includes('=') || fragment.includes('@')));
}

/**
 * Meta's script reports `location.href` (query and fragment included) with
 * every event, so a page whose URL carries a secret, a private path, or a
 * private `next` destination must not have the Pixel running.
 */
export function isMetaPixelTrackableUrl(pathname: string, search: string, hash = ''): boolean {
  if (isMetaPixelSecretUrl(pathname, search, hash)) return false;
  if (isPrivateAppPath(pathname)) return false;
  return !hasPrivateNextDestination(search);
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
/** Drops a conversion that would otherwise fire on a later page. */
function dropRegistrationConversion(pathname: string): void {
  if (pendingRegistrationFrom !== null && pendingRegistrationFrom !== pathname) {
    pendingRegistrationFrom = null;
  }
}

function referrerUrl(referrer: string): URL | null {
  if (!referrer) return null;
  try {
    return new URL(referrer);
  } catch {
    return null;
  }
}

export function syncMetaPixel(pixelId: string, page: MetaPixelPage): void {
  if (typeof window === 'undefined') return;
  const referrer = referrerUrl(page.referrer);
  const referrerUnreadable = page.referrer !== '' && referrer === null;
  const referrerSecret =
    referrer !== null && isMetaPixelSecretUrl(referrer.pathname, referrer.search, referrer.hash);
  const referrerPrivate =
    referrer !== null &&
    (isPrivateAppPath(referrer.pathname) || hasPrivateNextDestination(referrer.search));
  // A secret, or a referrer that already contains a private URL, stays on
  // document.referrer for every later event in this document.
  if (
    sensitiveDocument ||
    referrerUnreadable ||
    referrerSecret ||
    referrerPrivate ||
    isMetaPixelSecretUrl(page.pathname, page.search, page.hash)
  ) {
    sensitiveDocument = true;
    dropRegistrationConversion(page.pathname);
    pauseMetaPixel();
    return;
  }
  // A private page only pauses the Pixel. The stored consent choice is left
  // alone, and the next public page in this document is tracked again.
  if (isPrivateAppPath(page.pathname) || hasPrivateNextDestination(page.search)) {
    dropRegistrationConversion(page.pathname);
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
