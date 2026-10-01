import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { GET } from '../../../web/src/app/indexnow-key/[key]/route';

const WEB_ROOT = join(__dirname, '../../../web');
const KEY = 'indexnow-test-key';

describe('IndexNow key route', () => {
  const originalKey = process.env.INDEXNOW_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = originalKey;
  });

  it('serves exactly the server-side key as plain text', async () => {
    process.env.INDEXNOW_KEY = KEY;
    const response = await GET(new Request('https://agrobridge.ge/indexnow-test-key.txt'), {
      params: Promise.resolve({ key: KEY }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe(KEY);
  });

  it('does not serve a missing or mismatched key', async () => {
    delete process.env.INDEXNOW_KEY;
    const missing = await GET(new Request('https://agrobridge.ge/indexnow-test-key.txt'), {
      params: Promise.resolve({ key: KEY }),
    });
    expect(missing.status).toBe(404);

    process.env.INDEXNOW_KEY = KEY;
    const mismatch = await GET(new Request('https://agrobridge.ge/other.txt'), {
      params: Promise.resolve({ key: 'other-key' }),
    });
    expect(mismatch.status).toBe(404);
    expect(await mismatch.text()).toBe('');
  });

  it('rewrites the root key file without a public env var or auth', () => {
    const route = readFileSync(
      join(WEB_ROOT, 'src/app/indexnow-key/[key]/route.ts'),
      'utf8',
    );
    const config = readFileSync(join(WEB_ROOT, 'next.config.ts'), 'utf8');
    const middleware = readFileSync(join(WEB_ROOT, 'src/middleware.ts'), 'utf8');

    expect(existsSync(join(WEB_ROOT, 'src/app/indexnow-key/[key]/route.ts'))).toBe(true);
    expect(route).toContain('process.env.INDEXNOW_KEY');
    expect(route).not.toContain('NEXT_PUBLIC_INDEXNOW_KEY');
    expect(route).not.toContain('apiRequest');
    expect(config).toContain("source: '/:indexnowKey.txt'");
    expect(config).toContain("destination: '/indexnow-key/:indexnowKey'");
    expect(middleware).toContain('_vercel|api|.*\\\\..*');
  });
});
