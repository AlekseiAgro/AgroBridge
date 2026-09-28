import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function source(name: string): string {
  return readFileSync(join(WEB, 'src', name), 'utf8');
}

function apiSource(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8');
}

describe('My Products card metrics', () => {
  const page = source('app/[locale]/dashboard/products/page.tsx');
  const actions = source('components/MyProductCardActions.tsx');
  const record = source('components/RecordProductView.tsx');
  const productPage = source('app/[locale]/products/[id]/page.tsx');
  const css = source('app/globals.css');
  const viewsRoute = source('app/api/products/[id]/views/route.ts');
  const catalog = source('app/[locale]/catalog/page.tsx');

  it('renders compact view and subscriber counts on My Products cards', () => {
    expect(page).toContain('product-list__metrics');
    expect(page).toContain("t('viewCount', { count: product.viewCount ?? 0 })");
    expect(page).toContain("t('subscriberCount', { count: product.watchCount ?? 0 })");
    expect(page).toContain("t('cardMetricsLabel')");
    expect(page).toContain('product.viewCount');
    expect(page).toContain('product.watchCount');
    expect(page.indexOf('product-list__metrics')).toBeGreaterThan(
      page.indexOf('product-list__status'),
    );
    expect(page.indexOf('product-list__metrics')).toBeLessThan(
      page.indexOf('MyProductCardActions'),
    );
  });

  it('keeps metrics secondary and does not turn them into buttons or a dashboard', () => {
    expect(page).not.toMatch(/product-list__metrics[\s\S]*<button/);
    expect(page).not.toContain('chart');
    expect(page).not.toContain('featured');
    expect(page).not.toContain('organicViews');
    expect(actions).toContain("t('updateAvailability')");
    expect(actions).toContain("className=\"button button--primary product-list__action--primary\"");
    expect(css).toContain('.product-list__item--mine .product-list__metrics');
    expect(css).toContain('pointer-events: none');
    expect(css).toMatch(
      /\.product-list__item--mine \.product-list__metrics[\s\S]{0,280}font-size: 0\.8rem/,
    );
    expect(css).toContain('flex-wrap: wrap');
  });

  it('does not leak HarvestWatch subscriber identities on the card', () => {
    expect(page).not.toContain('harvestWatches');
    expect(page).not.toContain('watcher');
    expect(page).not.toContain('userId');
    expect(page).not.toContain('listMyWatches');
    expect(page).not.toContain('HarvestWatch');
    expect(actions).not.toContain('watchCount');
  });

  it('records public product-detail views and skips the seller preview', () => {
    expect(productPage).toContain('RecordProductView');
    expect(productPage).toContain('isOwner={Boolean(product.isOwner)}');
    expect(record).toContain("if (isOwner)");
    expect(record).toContain("`/api/products/${productId}/views`");
    expect(record).toContain("method: 'POST'");
    expect(viewsRoute).toContain("apiRequest<{ recorded: boolean }>(`/products/${id}/views`");
    expect(viewsRoute).toContain('visitorAddressOf(request)');
    expect(viewsRoute).toContain('getAuthToken()');
    const controller = apiSource('products.controller.ts');
    expect(controller).toContain("@Post(':id/views')");
    expect(controller).toContain('OptionalJwtAuthGuard');
    expect(controller).toContain('recordPublicProductView');
    expect(controller).not.toContain('harvestWatch.findMany');
  });

  it('does not show seller metrics on the public catalog', () => {
    expect(catalog).not.toContain('viewCount');
    expect(catalog).not.toContain('watchCount');
    expect(catalog).not.toContain('product-list__metrics');
    expect(productPage).not.toContain('product-list__metrics');
  });

  it('leaves existing My Products availability actions unchanged', () => {
    expect(page).toContain('HarvestStatusBadge');
    expect(page).toContain('MyProductCardActions');
    expect(page).toContain("t('preview')");
    expect(actions).toContain("t('markSoldOut')");
    expect(actions).toContain('DeleteProductButton');
  });
});

describe('My Products card metrics locales', () => {
  const KEYS = [
    'product.cardMetricsLabel',
    'product.viewCount',
    'product.subscriberCount',
  ] as const;

  it('keeps English as the canonical source', () => {
    const en = messages('en');
    expect(read(en, 'product.viewCount')).toContain('view');
    expect(read(en, 'product.subscriberCount')).toContain('subscriber');
    expect(read(en, 'product.cardMetricsLabel')).toBe(
      'Product views and harvest subscribers',
    );
  });

  it.each(LOCALES)('%s has My Products metrics keys', (locale) => {
    const data = messages(locale);
    for (const key of KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });
});
