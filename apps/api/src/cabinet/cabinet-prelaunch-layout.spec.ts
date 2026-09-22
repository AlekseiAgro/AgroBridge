import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web/src');
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('cabinet prelaunch settings, shell, and mobile layout', () => {
  it('moves password change and account deletion to Account Settings', () => {
    const overview = readWeb('app/[locale]/account/page.tsx');
    const settings = readWeb('app/[locale]/account/settings/page.tsx');

    expect(overview).not.toContain('ChangePasswordForm');
    expect(overview).not.toContain('DeleteAccountButton');
    expect(overview).not.toContain('cabinet-security');
    expect(settings).toContain('ChangePasswordForm');
    expect(settings).toContain('DeleteAccountButton');
  });

  it('keeps marketplace routes in one CabinetOrPublicShell instead of copying CabinetShell', () => {
    const shell = readWeb('components/CabinetOrPublicShell.tsx');
    const catalogLayout = readWeb('app/[locale]/catalog/layout.tsx');
    const requestsLayout = readWeb('app/[locale]/requests/layout.tsx');
    const catalogPage = readWeb('app/[locale]/catalog/page.tsx');
    const requestsPage = readWeb('app/[locale]/requests/page.tsx');
    const home = readWeb('app/[locale]/page.tsx');
    const product = readWeb('app/[locale]/products/[id]/page.tsx');

    expect(shell).toContain('emailVerified');
    expect(shell).toContain('CabinetShell');
    expect(shell).toContain('SiteHeader');
    expect(catalogLayout).toContain('CabinetOrPublicShell');
    expect(requestsLayout).toContain('CabinetOrPublicShell');
    expect(catalogPage).not.toContain('SiteHeader');
    expect(catalogPage).not.toContain('CabinetShell');
    expect(requestsPage).not.toContain('SiteHeader');
    expect(requestsPage).not.toContain('CabinetShell');
    expect(home).toContain('SiteHeader');
    expect(home).not.toContain('CabinetShell');
    expect(product).toContain('SiteHeader');
    expect(product).not.toContain('CabinetShell');
  });

  it('exposes Settings in the cabinet sidebar and localizes it in every locale', () => {
    const nav = readWeb('components/CabinetShell.tsx');
    expect(nav).toContain("href=\"/account/settings\">{t('settings')}");
    expect(nav).toContain('NotificationBell');
    expect(nav).toContain('ChatNavLink');

    for (const locale of LOCALES) {
      const messages = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
        nav: { settings: string };
        cabinet: { settingsTitle: string; settingsSubtitle: string };
      };
      expect(messages.nav.settings.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.settingsTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.settingsSubtitle.trim().length).toBeGreaterThan(0);
    }

    const ru = JSON.parse(readFileSync(join(MESSAGES_DIR, 'ru.json'), 'utf8')) as {
      nav: { settings: string };
      cabinet: { settingsTitle: string };
    };
    expect(ru.nav.settings).toBe('Настройки');
    expect(ru.cabinet.settingsTitle).toBe('Настройки');
    expect(`${ru.nav.settings} ${ru.cabinet.settingsTitle}`.toLowerCase()).not.toContain('котиров');
  });

  it('applies the mobile cabinet grid after the desktop two-column rule', () => {
    const css = readWeb('app/globals.css');
    const desktop = css.lastIndexOf('grid-template-columns: 16.5rem minmax(0, 1fr);');
    const mobile = css.lastIndexOf('grid-template-columns: minmax(0, 1fr);');
    expect(desktop).toBeGreaterThan(0);
    expect(mobile).toBeGreaterThan(desktop);
    expect(css).not.toMatch(/\.cabinet\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('establishes a marketplace container on cabinet content without wrapping desktop nav', () => {
    const css = readWeb('app/globals.css');
    const shell = readWeb('components/CabinetShell.tsx');
    const menu = readWeb('components/CabinetMobileMenu.tsx');

    expect(css).toMatch(/\.cabinet__content\s*\{[\s\S]*?container:\s*marketplace\s*\/\s*inline-size/);
    expect(css).toMatch(/\.cabinet-page\s*\{[\s\S]*?width:\s*min\(100%,\s*56rem\)/);
    expect(css).toMatch(/\.cabinet-page--narrow\s*\{[\s\S]*?width:\s*min\(100%,\s*32rem\)/);
    expect(css).not.toMatch(/\.cabinet__nav\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.cabinet__sidebar\s*\{[\s\S]*?display:\s*none/);
    expect(css).toContain('.cabinet__mobile-nav');
    expect(css).toContain('.cabinet__drawer');
    expect(css).toMatch(/\.page__main \.product-list__item--row/);
    expect(css).not.toMatch(/\.cabinet\s*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/body[^{]*\{[^}]*overflow-x:\s*hidden/);

    expect(shell).toContain('CabinetMobileMenu');
    expect(shell).toContain("tc('openMenu')");
    expect(shell).toContain("tc('closeMenu')");
    expect(shell).toContain('cabinet__brand--bar');
    expect(shell).toContain("href=\"/catalog\">{tCatalog('title')}");
    expect(shell).toContain("href=\"/requests\">{t('purchaseRequests')}");
    expect(shell).toContain('NotificationBell');
    expect(shell).toContain('<LanguageSwitcher />');
    expect(shell.split('<LanguageSwitcher />').length).toBe(2);
    expect(menu).toContain('cabinet__menu-button');
    expect(menu).toContain('role="dialog"');
    expect(menu).toContain('Escape');

    for (const locale of LOCALES) {
      const messages = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
        cabinet: { openMenu: string; closeMenu: string };
      };
      expect(messages.cabinet.openMenu.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.closeMenu.trim().length).toBeGreaterThan(0);
    }
  });
});
