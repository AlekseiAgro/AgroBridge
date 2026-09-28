import { readFileSync } from 'fs';
import { join } from 'path';
import { loginRedirectHref } from '../../../web/src/lib/protected-next-path';
import { safeNextPath } from '../../../web/src/lib/safe-next-path';

const WEB = join(__dirname, '../../../web/src');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('guest actions keep a safe login next path', () => {
  const watch = readWeb('components/HarvestWatchButton.tsx');
  const board = readWeb('app/[locale]/requests/page.tsx');
  const detail = readWeb('app/[locale]/requests/[id]/page.tsx');
  const product = readWeb('app/[locale]/products/[id]/page.tsx');

  it('returns a guest from Harvest Watch to the product alerts section', () => {
    const guest = watch.slice(watch.indexOf('if (!isLoggedIn)'), watch.indexOf('if (isOwner)'));
    expect(guest).toContain('loginRedirectHref(`/products/${productId}#harvest-alerts`)');
    expect(guest).not.toContain('fetch(');
    expect(guest).not.toContain("method: 'POST'");
    expect(watch).not.toContain('useEffect');

    const href = loginRedirectHref('/products/prod-1#harvest-alerts');
    expect(href.startsWith('/login?next=')).toBe(true);
    expect(href.includes('#')).toBe(false);
    expect(decodeURIComponent(href.slice(href.indexOf('next=') + 5))).toBe(
      '/products/prod-1#harvest-alerts',
    );
    expect(safeNextPath('/products/prod-1#harvest-alerts')).toBe('/products/prod-1#harvest-alerts');
  });

  it('returns a guest from the purchase-request board to that board', () => {
    expect(board).toContain(
      "const requestsPath = hasFilters ? `/requests?${query.toString()}` : '/requests'",
    );
    expect(board).toContain('const loginHref = loginRedirectHref(requestsPath)');
    expect(board.match(/href=\{loginHref\}/g)).toHaveLength(2);
    expect(board).toContain("t('loginToCreate')");
    expect(board).toContain('href="/requests/new"');
    expect(board).not.toContain('href="/login"');
    expect(board).not.toContain("loginRedirectHref('/requests/new')");

    const href = loginRedirectHref('/requests?q=apples&category=fruits');
    expect(decodeURIComponent(href.slice(href.indexOf('next=') + 5))).toBe(
      '/requests?q=apples&category=fruits',
    );
    expect(safeNextPath('/requests?q=apples&category=fruits')).toBe(
      '/requests?q=apples&category=fruits',
    );
  });

  it('returns a guest from Log in to respond to the same request', () => {
    const hrefAt = detail.indexOf('loginRedirectHref(`/requests/${request.id}`)');
    const respondAt = detail.indexOf("t('loginToRespond')");
    expect(hrefAt).toBeGreaterThan(-1);
    expect(respondAt).toBeGreaterThan(hrefAt);
    expect(respondAt - hrefAt).toBeLessThan(250);
    expect(detail).not.toContain('href="/login"');
    expect(detail).not.toContain('fetch(');

    const href = loginRedirectHref('/requests/req-1');
    expect(href).toBe(`/login?next=${encodeURIComponent('/requests/req-1')}`);
    expect(safeNextPath('/requests/req-1')).toBe('/requests/req-1');
  });

  it('leaves the existing product RFQ login next path unchanged', () => {
    expect(product).toContain(
      "href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}",
    );
    expect(product).toContain("tr('loginToRequest')");
    expect(product).not.toContain('loginRedirectHref(`/products/${product.id}#request-quote`)');
    expect(product).toContain('href="#request-quote"');
  });

  it('does not send an already signed-in harvest watcher through login', () => {
    const signedIn = watch.slice(watch.indexOf('if (isOwner)'));
    expect(signedIn).not.toContain('loginRedirectHref');
    expect(signedIn).toContain("fetch(`/api/products/${productId}/watch`");
    expect(signedIn).toContain("method: watching ? 'DELETE' : 'POST'");
    expect(product).toContain('isLoggedIn={Boolean(user)}');
  });

  it('still rejects external and protocol-relative login destinations', () => {
    expect(safeNextPath('https://evil.example/phish')).toBe('/account');
    expect(safeNextPath('http://evil.example')).toBe('/account');
    expect(safeNextPath('//evil.example/products/1')).toBe('/account');
    expect(safeNextPath('javascript:alert(1)')).toBe('/account');
    expect(safeNextPath('/products/1')).toBe('/products/1');
    expect(loginRedirectHref('https://evil.example')).toBe(
      `/login?next=${encodeURIComponent('https://evil.example')}`,
    );
    expect(safeNextPath('https://evil.example', '/account')).toBe('/account');
  });

  it('keeps locale prefixes off the next path so the router adds one locale', () => {
    for (const locale of LOCALES) {
      const productNext = '/products/prod-1#harvest-alerts';
      const requestNext = '/requests/req-1';
      for (const nextPath of [productNext, requestNext]) {
        const href = loginRedirectHref(nextPath);
        expect(href.startsWith('/login?next=')).toBe(true);
        expect(href).not.toContain(`/${locale}/`);
        expect(href).not.toContain('//');
        const decoded = decodeURIComponent(href.slice(href.indexOf('next=') + 5));
        expect(decoded).toBe(nextPath);
        expect(decoded.startsWith(`/${locale}/`)).toBe(false);
      }
    }

    expect(watch).not.toContain('/en/products');
    expect(watch).not.toContain('/ru/login');
    expect(detail).not.toContain('/en/requests');
    expect(board).not.toContain('/ka/requests');
  });

  it('leaves generic login links without an invented destination', () => {
    expect(readWeb('components/SiteHeader.tsx')).toContain("href=\"/login\">{t('login')}");
    expect(readWeb('components/SiteFooter.tsx')).toContain("href=\"/login\">{tn('login')}");
    expect(readWeb('app/[locale]/forgot-password/page.tsx')).toContain('href="/login"');
    expect(readWeb('app/[locale]/reset-password/page.tsx')).toContain('href="/login"');
  });
});
