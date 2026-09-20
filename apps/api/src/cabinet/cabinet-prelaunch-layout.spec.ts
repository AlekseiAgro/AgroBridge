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
});
