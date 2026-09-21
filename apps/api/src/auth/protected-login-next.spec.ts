import { readFileSync } from 'fs';
import { join } from 'path';
import {
  loginRedirectHref,
  protectedNextFromRequest,
} from '../../web/src/lib/protected-next-path';

const WEB = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('protected login next path', () => {
  it('preserves /en/dashboard/notifications instead of collapsing to /account', () => {
    const nextPath = protectedNextFromRequest('/en/dashboard/notifications', '');
    expect(nextPath).toBe('/dashboard/notifications');
    expect(loginRedirectHref(nextPath)).toBe(
      `/login?next=${encodeURIComponent('/dashboard/notifications')}`,
    );
    expect(loginRedirectHref(nextPath)).not.toContain(encodeURIComponent('/account'));
  });

  it('preserves /en/account/settings rather than /account', () => {
    const nextPath = protectedNextFromRequest('/en/account/settings', '');
    expect(nextPath).toBe('/account/settings');
    expect(nextPath).not.toBe('/account');
    expect(loginRedirectHref(nextPath)).toBe(
      `/login?next=${encodeURIComponent('/account/settings')}`,
    );
  });

  it('strips the locale prefix so next-intl can re-apply the active locale', () => {
    expect(protectedNextFromRequest('/ru/dashboard/notifications', '')).toBe(
      '/dashboard/notifications',
    );
    expect(protectedNextFromRequest('/ka/account/settings', '')).toBe('/account/settings');
    expect(protectedNextFromRequest('/de/dashboard/quotes', '?status=open')).toBe(
      '/dashboard/quotes?status=open',
    );
  });

  it('preserves query parameters on settings deep links', () => {
    const nextPath = protectedNextFromRequest(
      '/en/account/settings',
      '?section=notifications',
    );
    expect(nextPath).toBe('/account/settings?section=notifications');
    expect(loginRedirectHref(nextPath)).toBe(
      `/login?next=${encodeURIComponent('/account/settings?section=notifications')}`,
    );
  });

  it('falls back to /account only when the request path is missing', () => {
    expect(protectedNextFromRequest(null, '')).toBe('/account');
    expect(protectedNextFromRequest('', '?section=notifications')).toBe('/account');
  });

  it('leaves verified-user return and email checks on the existing helper', () => {
    const helper = readWeb('lib/require-verified-user.ts');
    expect(helper).toContain('getCurrentUser');
    expect(helper).toContain('emailVerified');
    expect(helper).toContain('return user');
    expect(helper).toContain('return nextPath');
    expect(helper).toContain('verifyEmailRedirectHref(nextPath)');
  });

  it('keeps cabinet layouts from hard-coding /account as the login next path', () => {
    const account = readWeb('app/[locale]/account/layout.tsx');
    const dashboard = readWeb('app/[locale]/dashboard/layout.tsx');
    const helper = readWeb('lib/require-verified-user.ts');
    const middleware = readWeb('middleware.ts');

    expect(account).not.toContain("requireVerifiedUser(locale, '/account')");
    expect(dashboard).not.toContain("requireVerifiedUser(locale, '/account')");
    expect(account).toContain('requireVerifiedUser(locale)');
    expect(dashboard).toContain('requireVerifiedUser(locale)');

    expect(helper).toContain('protectedNextFromRequest');
    expect(helper).toContain('loginRedirectHref');
    expect(helper).toContain('getCurrentUser');
    expect(helper).toContain('emailVerified');
    expect(helper).toContain('return user');

    expect(middleware).toContain('REQUEST_PATHNAME_HEADER');
    expect(middleware).toContain('REQUEST_SEARCH_HEADER');
    expect(middleware).toContain('request.nextUrl.pathname');
    expect(middleware).toContain('request.nextUrl.search');
    expect(middleware).toContain('createMiddleware');
  });
});
