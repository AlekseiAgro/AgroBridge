import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('seller and buyer landing pages', () => {
  it('keeps the primary seller cards and CTAs', () => {
    const sellers = readWeb('app/[locale]/sellers/page.tsx');
    expect(sellers).toContain("t('paths.requests.title')");
    expect(sellers).toContain("t('paths.requests.cta')");
    expect(sellers).toContain("t('paths.offer.title')");
    expect(sellers).toContain("t('paths.offer.cta')");
    expect(sellers).toContain("href: '/requests'");
    expect(sellers).toContain("href: offerHref");
  });

  it('keeps the primary buyer cards and CTAs', () => {
    const buyers = readWeb('app/[locale]/buyers/page.tsx');
    expect(buyers).toContain("t('paths.catalog.title')");
    expect(buyers).toContain("t('paths.catalog.cta')");
    expect(buyers).toContain("t('paths.request.title')");
    expect(buyers).toContain("t('paths.request.cta')");
    expect(buyers).toContain("href: '/catalog'");
    expect(buyers).toContain("href: '/requests/new'");
  });

  it('does not render the lower RoleHub navigation row', () => {
    const sellers = readWeb('app/[locale]/sellers/page.tsx');
    const buyers = readWeb('app/[locale]/buyers/page.tsx');
    expect(sellers).not.toContain('asideLinks');
    expect(sellers).not.toContain('asideNote');
    expect(sellers).not.toContain('chatUnreadCount');
    expect(buyers).not.toContain('asideLinks');
    expect(buyers).not.toContain('asideNote');
    expect(buyers).not.toContain('chatUnreadCount');
  });

  it('leaves cabinet sidebar navigation in CabinetShell', () => {
    const shell = readWeb('components/CabinetShell.tsx');
    expect(shell).toContain("href=\"/dashboard/products\"");
    expect(shell).toContain("href=\"/dashboard/farm\"");
    expect(shell).toContain('ChatNavLink');
    expect(shell).toContain('NotificationBell');
  });

  it('keeps the home hero on the dedicated landscape asset', () => {
    const home = readWeb('app/[locale]/page.tsx');
    const media = readWeb('lib/category-media.ts');
    expect(home).toContain("src=\"/images/hero/farm-landscape.jpg\"");
    expect(media).toContain("other: '/images/categories/other.jpg'");
    expect(media).not.toContain("other: '/images/hero/farm-landscape.jpg'");
  });
});
