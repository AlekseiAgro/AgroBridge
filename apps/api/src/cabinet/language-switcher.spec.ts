import { localeSwitchHref, localeSwitchPathname } from '../../../web/src/lib/locale-switch-href';
import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');
const LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('route-preserving language switcher', () => {
  it('strips a locale prefix and keeps pathname, dynamic segments, and query', () => {
    expect(localeSwitchPathname('/catalog')).toBe('/catalog');
    expect(localeSwitchPathname('/en/catalog')).toBe('/catalog');
    expect(localeSwitchPathname('/ru/dashboard/quotes')).toBe('/dashboard/quotes');
    expect(localeSwitchPathname('/de/products/prod_123')).toBe('/products/prod_123');
    expect(localeSwitchPathname('/fr/requests/abc')).toBe('/requests/abc');
    expect(localeSwitchPathname('/ka/account/settings')).toBe('/account/settings');
    expect(localeSwitchPathname('/it')).toBe('/');
    expect(localeSwitchPathname('/')).toBe('/');

    expect(localeSwitchHref('/ru/catalog', '?q=honey&region=kakheti')).toBe(
      '/catalog?q=honey&region=kakheti',
    );
    expect(localeSwitchHref('/en/dashboard/purchase-requests', 'status=open')).toBe(
      '/dashboard/purchase-requests?status=open',
    );
    expect(localeSwitchHref('/ka/requests/42', '')).toBe('/requests/42');
    expect(localeSwitchHref('/es/login', '?next=%2Faccount')).toBe('/login?next=%2Faccount');
  });

  it('uses next-intl locale Links instead of sending users home', () => {
    const switcher = readWeb('components/LanguageSwitcher.tsx');
    expect(switcher).toContain("from '@/i18n/navigation'");
    expect(switcher).toContain("from '@/i18n/routing'");
    expect(switcher).toContain('usePathname');
    expect(switcher).toContain('useSearchParams');
    expect(switcher).toContain('localeSwitchHref');
    expect(switcher).toContain('locale={code as Locale}');
    expect(switcher).not.toMatch(/href=["']\/["']/);
    expect(switcher).not.toContain('router.push("/")');
    expect(switcher).toContain('LOCALE_LABELS');
    expect(switcher).toContain('locale.toUpperCase()');
    expect(switcher).not.toMatch(/flag|emoji/i);
  });

  it('keeps one switcher in the public header and moves the cabinet copy to the top bar', () => {
    const header = readWeb('components/SiteHeader.tsx');
    const cabinet = readWeb('components/CabinetShell.tsx');
    const foot = cabinet.slice(
      cabinet.indexOf('cabinet__sidebar-foot'),
      cabinet.indexOf('cabinet__main'),
    );
    const top = cabinet.slice(cabinet.indexOf('cabinet__top-actions'));

    expect(header).toContain('<LanguageSwitcher />');
    expect(header).toContain("href=\"/catalog\">{t('catalog')}");
    expect(header).toContain("href=\"/requests\">{t('purchaseRequests')}");
    expect(header).toContain("href=\"/how-it-works\">{t('howItWorks')}");
    expect(header).toContain("href=\"/login\">{t('login')}");
    expect(header).toContain("href=\"/register\">{t('register')}");
    expect(header).not.toContain('href="/buyers"');
    expect(header).not.toContain('href="/sellers"');

    expect(top).toContain('<LanguageSwitcher />');
    expect(top).toContain('NotificationBell');
    expect(foot).toContain('LogoutButton');
    expect(foot).not.toContain('LanguageSwitcher');
    expect(cabinet).not.toContain("href=\"/buyers\"");
    expect(cabinet.split('<LanguageSwitcher />').length).toBe(2);
  });

  it('does not add a sidebar Language nav item', () => {
    const cabinet = readWeb('components/CabinetShell.tsx');
    const nav = cabinet.slice(cabinet.indexOf('cabinet__nav'), cabinet.indexOf('cabinet__sidebar-foot'));
    expect(nav).not.toContain('LanguageSwitcher');
    expect(nav).not.toContain("t('language')");
  });

  it('lists every product locale by native name', () => {
    const switcher = readWeb('components/LanguageSwitcher.tsx');
    expect(switcher).toContain('routing.locales.map');
    for (const locale of LOCALES) {
      expect(readWeb(`../messages/${locale}.json`)).toContain('"language"');
    }
  });
});
