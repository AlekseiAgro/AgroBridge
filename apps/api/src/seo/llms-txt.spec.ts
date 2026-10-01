import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { LOCALES } from '@agrobridge/shared';
import { GET } from '../../../web/src/app/llms.txt/route';
import { buildLlmsTxt, LLMS_TXT_CONTENT_TYPE } from '../../../web/src/lib/llms-txt';
import { STATIC_PUBLIC_PATHS, localizedPublicUrl } from '../../../web/src/lib/seo-sitemap';

const WEB_SRC = join(__dirname, '../../../web/src');

const PUBLIC_SECTIONS = [
  '/catalog',
  '/buyers',
  '/sellers',
  '/how-it-works',
  '/support',
  '/legal',
  '/terms',
  '/privacy',
] as const;

describe('/llms.txt', () => {
  it('exposes a public Next route', () => {
    expect(existsSync(join(WEB_SRC, 'app/llms.txt/route.ts'))).toBe(true);
    const route = readFileSync(join(WEB_SRC, 'app/llms.txt/route.ts'), 'utf8');
    expect(route).toContain('export function GET');
    expect(route).not.toContain('apiRequest');
    expect(route).not.toContain('fetch(');
    const middleware = readFileSync(join(WEB_SRC, 'middleware.ts'), 'utf8');
    expect(middleware).toContain('_vercel|api|.*\\\\..*');
  });

  it('returns HTTP 200 plain text without authentication', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(LLMS_TXT_CONTENT_TYPE);
    expect(await response.text()).toBe(buildLlmsTxt());
  });

  it('identifies AgroBridge, the operator, and the official website', () => {
    const body = buildLlmsTxt();
    expect(body).toContain('# AgroBridge');
    expect(body).toContain('https://agrobridge.ge/ is the official AgroBridge website.');
    expect(body).toContain('Official website: https://agrobridge.ge/');
    expect(body).toContain(
      'AgroBridge is a Georgian B2B agricultural marketplace connecting Georgian farms and producers with buyers in Georgia and international markets.',
    );
    expect(body).toContain('P/E VANO MEGVINETUKHUTSESI');
    expect(body).toContain('01501157152');
    expect(body).toContain('Tbilisi, Georgia');
    expect(body).toContain('The binding legal texts are available in Georgian and English.');
  });

  it('links every locale homepage and the public sections', () => {
    const body = buildLlmsTxt();
    for (const locale of LOCALES) {
      expect(body).toContain(`- ${localizedPublicUrl(locale)}`);
    }
    for (const path of PUBLIC_SECTIONS) {
      expect(STATIC_PUBLIC_PATHS).toContain(path);
      expect(body).toContain(`- ${localizedPublicUrl('en', path)}`);
    }
    expect(body).toContain(`- ${localizedPublicUrl('ka', '/legal')}`);
    expect(body).toContain(`- ${localizedPublicUrl('ka', '/terms')}`);
    expect(body).toContain(`- ${localizedPublicUrl('ka', '/privacy')}`);
  });

  it('does not list private routes, the API, or similarly named third-party domains', () => {
    const body = buildLlmsTxt();
    expect(body).not.toContain('/dashboard');
    expect(body).not.toContain('/account');
    expect(body).not.toContain('/requests/new');
    expect(body).not.toContain('/users');
    expect(body).not.toContain('/products/');
    expect(body).not.toContain('/farms/');
    expect(body).not.toContain('api.agrobridge.ge');
    expect(body).not.toContain('agrobridge.shop');
    expect(body).not.toContain('agrobridge.app');
    expect(body).not.toContain('llms-full.txt');
  });
});
